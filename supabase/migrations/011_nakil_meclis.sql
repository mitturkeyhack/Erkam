-- ERKAM — Nakil, İktibas, Tadil, Görülme, Seçkin, Meclis odası, Uzlet

-- ================= Gizlilik: doğum tarihi herkese açık profiller tablosundan ayrı, kapalı tabloda =================
create table if not exists public.profil_gizli (
  id uuid primary key references public.profiller(id) on delete cascade,
  dogum_tarihi date
);
alter table public.profil_gizli enable row level security;
insert into public.profil_gizli (id, dogum_tarihi) select id, dogum_tarihi from public.profiller where dogum_tarihi is not null
  on conflict (id) do update set dogum_tarihi = excluded.dogum_tarihi;

-- ================= Kelam sütunları =================
alter table public.kelamlar
  add column if not exists nakil_id uuid references public.kelamlar(id) on delete cascade,
  add column if not exists iktibas_id uuid references public.kelamlar(id) on delete set null,
  add column if not exists nakil_sayisi int not null default 0,
  add column if not exists gorulme int not null default 0,
  add column if not exists tadil timestamptz;
create unique index if not exists kelam_nakil_tek on public.kelamlar (yazar, nakil_id) where nakil_id is not null;
create index if not exists kelam_nakil_idx on public.kelamlar (nakil_id) where nakil_id is not null;
create index if not exists kelam_iktibas_idx on public.kelamlar (iktibas_id) where iktibas_id is not null;

alter table public.profiller
  add column if not exists seckin uuid references public.kelamlar(id) on delete set null,
  add column if not exists uzlet boolean not null default false,
  add column if not exists uzlet_tarih timestamptz;

alter table public.bildirimler drop constraint if exists bildirimler_tur_check;
alter table public.bildirimler add constraint bildirimler_tur_check check (tur = any (array['hosgeldin','tasdik','cevap','etiket','yoldas','istek','kabul','duyuru','uyari','nakil','iktibas']));

-- görülme kayıtları (kişi başı bir kez)
create table if not exists public.kelam_gorenler (
  kelam uuid not null references public.kelamlar(id) on delete cascade,
  kisi uuid not null references public.profiller(id) on delete cascade,
  primary key (kelam, kisi)
);
alter table public.kelam_gorenler enable row level security;

-- ================= Görünürlük: uzlette olanlar da gizlenir =================
create or replace function public.gorebilir(p_yazar uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_yazar = (select auth.uid())
      or public.yonetim_mi()
      or (not exists (select 1 from public.profiller where id = p_yazar and (uzak or uzlet))
          and (not exists (select 1 from public.profiller where id = p_yazar and izole)
               or exists (select 1 from public.yoldasliklar
                           where takip_eden = (select auth.uid()) and takip_edilen = p_yazar and durum = 'onayli')));
$$;

-- ================= Kelam tetikleyicileri =================
create or replace function public.kelam_once()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ust public.kelamlar;
  v_k public.kelamlar;
  v_muhur text[];
  v_medya jsonb;
begin
  new.tasdik_sayisi := 0;
  new.cevap_sayisi := 0;
  new.nakil_sayisi := 0;
  new.gorulme := 0;
  new.tadil := null;
  new.olusturma := now();
  new.icerik := btrim(coalesce(new.icerik, ''));

  -- Nakil: içerik taşımaz, asıl kelamı işaret eder
  if new.nakil_id is not null then
    select * into v_k from public.kelamlar where id = new.nakil_id;
    if not found then raise exception 'kelam_yok'; end if;
    if v_k.nakil_id is not null then new.nakil_id := v_k.nakil_id; select * into v_k from public.kelamlar where id = new.nakil_id; end if;
    if not public.gorebilir(v_k.yazar) then raise exception 'yetki_yok'; end if;
    if exists (select 1 from public.profiller where id = v_k.yazar and izole) and v_k.yazar <> new.yazar then raise exception 'gizli_hesap'; end if;
    new.icerik := ''; new.muhurler := '{}'; new.medya := '[]'::jsonb; new.ust_id := null; new.iktibas_id := null; new.gorsel_yol := null;
    new.kategori := v_k.kategori;
    if (select count(*) from public.kelamlar where yazar = new.yazar and olusturma > now() - interval '1 minute') >= 8 then
      raise exception 'cok_hizli';
    end if;
    return new;
  end if;

  select coalesce(array_agg(m), '{}') into v_muhur from (
    select distinct m from (
      select regexp_replace(lower(btrim(x)), '[^a-z0-9çğıöşü_]', '', 'g') as m
        from unnest(coalesce(new.muhurler, '{}')) x
    ) s where char_length(m) between 2 and 30
    limit 5
  ) t;
  new.muhurler := v_muhur;

  if jsonb_typeof(coalesce(new.medya, '[]'::jsonb)) <> 'array' then new.medya := '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'tur', e ->> 'tur', 'yol', e ->> 'yol', 'kapak', e ->> 'kapak',
           'g', case when e ->> 'g' ~ '^[0-9]{1,5}$' then (e ->> 'g')::int end,
           'y', case when e ->> 'y' ~ '^[0-9]{1,5}$' then (e ->> 'y')::int end,
           'sure', case when e ->> 'sure' ~ '^[0-9]{1,4}(\.[0-9]+)?$' then round((e ->> 'sure')::numeric, 1) end))), '[]'::jsonb)
    into v_medya
    from (select e from jsonb_array_elements(coalesce(new.medya, '[]'::jsonb)) e
           where e ->> 'tur' in ('foto', 'video')
             and e ->> 'yol' like new.yazar::text || '/%'
             and (e ->> 'kapak' is null or e ->> 'kapak' like new.yazar::text || '/%')
           limit 4) s;
  if exists (select 1 from jsonb_array_elements(v_medya) e where e ->> 'tur' = 'video') and jsonb_array_length(v_medya) > 1 then
    raise exception 'medya_gecersiz';
  end if;
  new.medya := v_medya;

  -- İktibas: alıntılanan kelam görülebilir olmalı
  if new.iktibas_id is not null then
    select * into v_k from public.kelamlar where id = new.iktibas_id;
    if not found then raise exception 'kelam_yok'; end if;
    if v_k.nakil_id is not null then new.iktibas_id := v_k.nakil_id; select * into v_k from public.kelamlar where id = new.iktibas_id; end if;
    if not public.gorebilir(v_k.yazar) then raise exception 'yetki_yok'; end if;
    if exists (select 1 from public.profiller where id = v_k.yazar and izole) and v_k.yazar <> new.yazar then raise exception 'gizli_hesap'; end if;
    new.ust_id := null;
  end if;

  if char_length(new.icerik) = 0 and jsonb_array_length(new.medya) = 0 then
    raise exception 'bos_kelam';
  end if;

  if new.ust_id is not null then
    select * into v_ust from public.kelamlar where id = new.ust_id;
    if not found then raise exception 'kelam_yok'; end if;
    if not public.gorebilir(v_ust.yazar) then raise exception 'yetki_yok'; end if;
    if v_ust.nakil_id is not null then raise exception 'kelam_yok'; end if;
    if v_ust.ust_id is not null then new.ust_id := v_ust.ust_id; end if;
    new.kategori := v_ust.kategori;
    new.muhurler := '{}';
  end if;

  if (select count(*) from public.kelamlar
       where yazar = new.yazar and olusturma > now() - interval '1 minute') >= 8 then
    raise exception 'cok_hizli';
  end if;
  return new;
end $$;

create or replace function public.kelam_sonra()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ust_yazar uuid;
  v_asil_yazar uuid;
begin
  if new.nakil_id is not null or new.iktibas_id is not null then
    update public.kelamlar set nakil_sayisi = nakil_sayisi + 1 where id = coalesce(new.nakil_id, new.iktibas_id)
      returning yazar into v_asil_yazar;
    if v_asil_yazar is not null and v_asil_yazar <> new.yazar then
      insert into public.bildirimler (alici, kimden, tur, kelam_id)
        values (v_asil_yazar, new.yazar, case when new.nakil_id is not null then 'nakil' else 'iktibas' end,
                case when new.nakil_id is not null then new.nakil_id else new.id end);
    end if;
    if new.nakil_id is not null then return new; end if;
  end if;

  if new.ust_id is not null then
    update public.kelamlar set cevap_sayisi = cevap_sayisi + 1 where id = new.ust_id
      returning yazar into v_ust_yazar;
    if v_ust_yazar is not null and v_ust_yazar <> new.yazar then
      insert into public.bildirimler (alici, kimden, tur, kelam_id)
        values (v_ust_yazar, new.yazar, 'cevap', new.ust_id);
    end if;
  end if;

  insert into public.bildirimler (alici, kimden, tur, kelam_id)
    select p.id, new.yazar, 'etiket', coalesce(new.ust_id, new.id)
      from public.profiller p
     where p.kunye in (
             select distinct (regexp_matches(lower(new.icerik), '@([a-z0-9_]{3,20})', 'g'))[1] limit 5)
       and p.id <> new.yazar
       and p.id is distinct from v_ust_yazar
       and p.id is distinct from v_asil_yazar;
  return new;
end $$;

create or replace function public.kelam_silindi()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.ust_id is not null then
    update public.kelamlar set cevap_sayisi = greatest(cevap_sayisi - 1, 0) where id = old.ust_id;
  end if;
  if old.nakil_id is not null or old.iktibas_id is not null then
    update public.kelamlar set nakil_sayisi = greatest(nakil_sayisi - 1, 0) where id = coalesce(old.nakil_id, old.iktibas_id);
  end if;
  return old;
end $$;

-- ================= Kelam JSON =================
create or replace function public.kelam_json(k public.kelamlar)
returns jsonb language sql stable set search_path = '' as $$
  select case when k.nakil_id is not null then
    (select public.kelam_json(o) from public.kelamlar o where o.id = k.nakil_id)
      || jsonb_build_object('nakleden', (select public.profil_json(p) from public.profiller p where p.id = k.yazar),
                            'nakil_kayit', k.id, 'nakil_tarih', k.olusturma)
  else jsonb_build_object(
    'id', k.id, 'icerik', k.icerik, 'kategori', k.kategori, 'muhurler', k.muhurler,
    'gorsel_yol', k.gorsel_yol, 'medya', k.medya, 'ust_id', k.ust_id,
    'tasdik_sayisi', k.tasdik_sayisi, 'cevap_sayisi', k.cevap_sayisi, 'olusturma', k.olusturma,
    'nakil_sayisi', k.nakil_sayisi, 'gorulme', k.gorulme, 'tadil', k.tadil,
    'yazar', (select public.profil_json(p) from public.profiller p where p.id = k.yazar),
    'tasdikledim', exists (select 1 from public.tasdikler t where t.kelam_id = k.id and t.kisi_id = (select auth.uid())),
    'heybemde', exists (select 1 from public.heybe h where h.kelam_id = k.id and h.kisi_id = (select auth.uid())),
    'nakledildi', exists (select 1 from public.kelamlar n where n.nakil_id = k.id and n.yazar = (select auth.uid())),
    'iktibas', case when k.iktibas_id is null then null else coalesce(
      (select jsonb_build_object('id', q.id, 'icerik', left(q.icerik, 500), 'medya', q.medya, 'olusturma', q.olusturma,
              'yazar', (select public.profil_json(p) from public.profiller p where p.id = q.yazar))
         from public.kelamlar q where q.id = k.iktibas_id), '{"silindi": true}'::jsonb) end)
  end;
$$;

create or replace function public.kelam_listesi(p_kaynak text, p_yazar uuid default null, p_metin text default null, p_once timestamptz default null, p_limit integer default 20)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v jsonb;
  v_lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_like text;
begin
  if p_kaynak = 'sura' then
    select coalesce(jsonb_agg(j order by o desc), '[]'::jsonb) into v from (
      select public.kelam_json(k) as j, k.olusturma as o from public.kelamlar k
       where k.ust_id is null and (p_once is null or k.olusturma < p_once)
       order by k.olusturma desc limit v_lim) s where j is not null;
  elsif p_kaynak = 'yazar' then
    select coalesce(jsonb_agg(j order by o desc), '[]'::jsonb) into v from (
      select public.kelam_json(k) as j, k.olusturma as o from public.kelamlar k
       where k.yazar = p_yazar and k.ust_id is null and (p_once is null or k.olusturma < p_once)
       order by k.olusturma desc limit v_lim) s where j is not null;
  elsif p_kaynak = 'cevap' then
    select coalesce(jsonb_agg(j order by o desc), '[]'::jsonb) into v from (
      select public.kelam_json(k) as j, k.olusturma as o from public.kelamlar k
       where k.yazar = p_yazar and k.ust_id is not null and (p_once is null or k.olusturma < p_once)
       order by k.olusturma desc limit v_lim) s;
  elsif p_kaynak = 'muhur' then
    select coalesce(jsonb_agg(j order by o desc), '[]'::jsonb) into v from (
      select public.kelam_json(k) as j, k.olusturma as o from public.kelamlar k
       where k.muhurler @> array[lower(btrim(coalesce(p_metin, ''), ' #'))]
         and (p_once is null or k.olusturma < p_once)
       order by k.olusturma desc limit v_lim) s;
  elsif p_kaynak = 'ara' then
    v_like := '%' || replace(replace(replace(coalesce(p_metin, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
    select coalesce(jsonb_agg(j order by o desc), '[]'::jsonb) into v from (
      select public.kelam_json(k) as j, k.olusturma as o from public.kelamlar k
       where k.icerik ilike v_like and k.nakil_id is null and (p_once is null or k.olusturma < p_once)
       order by k.olusturma desc limit v_lim) s;
  elsif p_kaynak = 'heybe' then
    select coalesce(jsonb_agg(j order by o desc), '[]'::jsonb) into v from (
      select public.kelam_json(k) as j, h.olusturma as o
        from public.heybe h join public.kelamlar k on k.id = h.kelam_id
       where h.kisi_id = (select auth.uid()) and (p_once is null or h.olusturma < p_once)
       order by h.olusturma desc limit v_lim) s where j is not null;
  elsif p_kaynak = 'iktibas' then
    -- bir kelamı iktibas edenler
    select coalesce(jsonb_agg(j order by o desc), '[]'::jsonb) into v from (
      select public.kelam_json(k) as j, k.olusturma as o from public.kelamlar k
       where k.iktibas_id = p_yazar and (p_once is null or k.olusturma < p_once)
       order by k.olusturma desc limit v_lim) s;
  else
    v := '[]'::jsonb;
  end if;
  return v;
end $$;

-- ================= Nakil / İktibas / Tadil =================
drop function if exists public.kelam_nakset(text, text, text[], text, uuid, jsonb);
create or replace function public.kelam_nakset(p_icerik text, p_kategori text default 'ilim', p_muhurler text[] default '{}', p_gorsel text default null, p_ust uuid default null, p_medya jsonb default '[]'::jsonb, p_iktibas uuid default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v public.kelamlar;
  v_ben uuid := (select auth.uid());
  v_gorsel text := p_gorsel;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if v_gorsel is not null and v_gorsel not like v_ben::text || '/%' then v_gorsel := null; end if;
  insert into public.kelamlar (yazar, ust_id, icerik, kategori, muhurler, gorsel_yol, medya, iktibas_id)
    values (v_ben, case when p_iktibas is null then p_ust end, coalesce(p_icerik, ''), coalesce(p_kategori, 'ilim'), coalesce(p_muhurler, '{}'),
            v_gorsel, coalesce(p_medya, '[]'::jsonb), p_iktibas)
    returning * into v;
  return public.kelam_json(v);
end $$;

create or replace function public.kelam_nakil(p_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v_asil uuid;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  select coalesce(nakil_id, id) into v_asil from public.kelamlar where id = p_id;
  if v_asil is null then raise exception 'kelam_yok'; end if;
  delete from public.kelamlar where yazar = v_ben and nakil_id = v_asil;
  if not found then
    insert into public.kelamlar (yazar, nakil_id, icerik) values (v_ben, v_asil, '');
  end if;
  return jsonb_build_object('nakledildi', exists (select 1 from public.kelamlar where yazar = v_ben and nakil_id = v_asil),
    'nakil_sayisi', (select nakil_sayisi from public.kelamlar where id = v_asil));
end $$;

create or replace function public.kelam_tadil(p_id uuid, p_icerik text, p_muhurler text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); k public.kelamlar; v_muhur text[]; v_icerik text := btrim(coalesce(p_icerik, ''));
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  select * into k from public.kelamlar where id = p_id;
  if not found or k.yazar <> v_ben or k.nakil_id is not null then raise exception 'yetki_yok'; end if;
  if k.olusturma < now() - interval '15 minutes' then raise exception 'tadil_suresi'; end if;
  if (select uzak or (susturma_bitis is not null and susturma_bitis > now()) from public.profiller where id = v_ben) then raise exception 'susturuldun'; end if;
  if char_length(v_icerik) = 0 and jsonb_array_length(k.medya) = 0 then raise exception 'bos_kelam'; end if;
  if char_length(v_icerik) > 2000 then raise exception 'cok_uzun'; end if;
  if k.ust_id is null then
    select coalesce(array_agg(m), '{}') into v_muhur from (
      select distinct m from (select regexp_replace(lower(btrim(x)), '[^a-z0-9çğıöşü_]', '', 'g') as m from unnest(coalesce(p_muhurler, '{}')) x) s
       where char_length(m) between 2 and 30 limit 5) t;
  else
    v_muhur := '{}';
  end if;
  update public.kelamlar set icerik = v_icerik, muhurler = v_muhur, tadil = now() where id = p_id returning * into k;
  return public.kelam_json(k);
end $$;

-- ================= Görülme =================
create or replace function public.kelam_goruldu(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid());
begin
  if v_ben is null or p_ids is null then return; end if;
  with yeni as (
    insert into public.kelam_gorenler (kelam, kisi)
      select k.id, v_ben from public.kelamlar k
       where k.id = any (p_ids[1:60]) and k.yazar <> v_ben and k.nakil_id is null
    on conflict do nothing returning kelam)
  update public.kelamlar k set gorulme = gorulme + 1 from yeni where k.id = yeni.kelam;
end $$;

-- ================= Seçkin (profilde sabit kelam) =================
create or replace function public.kelam_seckin(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v_simdi uuid;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if not exists (select 1 from public.kelamlar where id = p_id and yazar = v_ben and ust_id is null and nakil_id is null) then raise exception 'yetki_yok'; end if;
  select seckin into v_simdi from public.profiller where id = v_ben;
  update public.profiller set seckin = case when v_simdi = p_id then null else p_id end where id = v_ben;
  return v_simdi is distinct from p_id;
end $$;

create or replace function public.profil_getir(p_kunye text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p public.profiller;
  v_ben uuid := (select auth.uid());
  v_iliski text;
  v_gor boolean;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  select * into p from public.profiller where kunye = lower(btrim(coalesce(p_kunye, ''), ' @'));
  if not found then return null; end if;
  if p.id = v_ben then
    v_iliski := 'ben';
  else
    select durum into v_iliski from public.yoldasliklar where takip_eden = v_ben and takip_edilen = p.id;
    v_iliski := coalesce(v_iliski, 'yok');
  end if;
  v_gor := public.gorebilir(p.id);
  if p.uzlet and p.id <> v_ben and not public.yonetim_mi() then
    return jsonb_build_object('id', p.id, 'kunye', p.kunye, 'isim', p.isim, 'uzlet', true, 'gorebilir', false, 'iliski', v_iliski, 'rol', p.rol, 'onayli', p.onayli);
  end if;
  return jsonb_build_object(
    'id', p.id, 'kunye', p.kunye, 'isim', p.isim, 'biyografi', p.biyografi,
    'avatar_yol', p.avatar_yol, 'kapak_yol', p.kapak_yol, 'izole', p.izole, 'rol', p.rol, 'onayli', p.onayli,
    'olusturma', p.olusturma, 'iliski', v_iliski, 'gorebilir', v_gor, 'uzlet', p.uzlet,
    'takip_edilen_sayisi', (select count(*) from public.yoldasliklar where takip_eden = p.id and durum = 'onayli'),
    'yoldas_sayisi', (select count(*) from public.yoldasliklar where takip_edilen = p.id and durum = 'onayli'),
    'kelam_sayisi', (select count(*) from public.kelamlar where yazar = p.id and ust_id is null and nakil_id is null),
    'seckin', case when v_gor and p.seckin is not null then (select public.kelam_json(k) from public.kelamlar k where k.id = p.seckin) end,
    'bekleyen_istek', case when p.id = v_ben
        then (select count(*) from public.yoldasliklar where takip_edilen = p.id and durum = 'bekliyor')
        else 0 end);
end $$;

-- ================= Uzlet =================
create or replace function public.uzlete_cekil()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid());
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  update public.profiller set uzlet = true, uzlet_tarih = now() where id = v_ben;
  delete from public.cihazlar where kullanici = v_ben;
  return true;
end $$;

create or replace function public.uzletten_don()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid());
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  update public.profiller set uzlet = false, uzlet_tarih = null where id = v_ben;
  return true;
end $$;

create or replace function public.mesaj_gonder(p_alici uuid, p_icerik text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v public.mesajlar;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if p_alici = v_ben then raise exception 'kendin'; end if;
  if not exists (select 1 from public.profiller where id = p_alici) then raise exception 'yoldas_yok'; end if;
  if exists (select 1 from public.profiller where id = p_alici and uzlet) then raise exception 'uzlette'; end if;
  insert into public.mesajlar (gonderen, alici, icerik) values (v_ben, p_alici, p_icerik)
    returning * into v;
  return jsonb_build_object('id', v.id, 'icerik', v.icerik, 'olusturma', v.olusturma,
                            'benden', true, 'okundu', false);
end $$;

create or replace function public.ara(p_q text)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  q text := btrim(coalesce(p_q, ''), ' @#');
  v_like text;
begin
  if char_length(q) < 2 then
    return jsonb_build_object('yoldaslar', '[]'::jsonb, 'muhurler', '[]'::jsonb, 'kelamlar', '[]'::jsonb);
  end if;
  v_like := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return jsonb_build_object(
    'yoldaslar', coalesce((select jsonb_agg(j) from (
        select public.profil_json(p) || jsonb_build_object('biyografi', p.biyografi) as j
          from public.profiller p
         where (p.kunye ilike v_like or p.isim ilike v_like)
           and (p.id = (select auth.uid()) or public.yonetim_mi() or not exists (
                 select 1 from public.profiller x where x.id = p.id and (x.uzlet or x.uzak)))
         order by (p.kunye = lower(q)) desc, p.kunye limit 12) s), '[]'::jsonb),
    'muhurler', coalesce((select jsonb_agg(jsonb_build_object('muhur', m, 'sayi', n)) from (
        select m, count(*) as n from public.kelamlar k, unnest(k.muhurler) m
         where m ilike v_like group by m order by count(*) desc, m limit 8) s), '[]'::jsonb),
    'kelamlar', public.kelam_listesi('ara', null, q, null, 20));
end $$;

-- ================= Meclis odaları =================
create table if not exists public.odalar (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (char_length(ad) between 2 and 40),
  kurucu uuid references public.profiller(id) on delete set null,
  olusturma timestamptz not null default now(),
  son_mesaj timestamptz not null default now()
);
create table if not exists public.oda_uyeleri (
  oda uuid not null references public.odalar(id) on delete cascade,
  kisi uuid not null references public.profiller(id) on delete cascade,
  rol text not null default 'uye' check (rol in ('kurucu', 'uye')),
  katilma timestamptz not null default now(),
  son_okunan bigint not null default 0,
  primary key (oda, kisi)
);
create index if not exists oda_uyeleri_kisi on public.oda_uyeleri (kisi);
create table if not exists public.oda_mesajlari (
  id bigserial primary key,
  oda uuid not null references public.odalar(id) on delete cascade,
  gonderen uuid references public.profiller(id) on delete set null,
  icerik text not null check (char_length(icerik) between 1 and 2000),
  tur text not null default 'mesaj' check (tur in ('mesaj', 'sistem')),
  olusturma timestamptz not null default now()
);
create index if not exists oda_mesajlari_oda on public.oda_mesajlari (oda, id desc);
alter table public.odalar enable row level security;
alter table public.oda_uyeleri enable row level security;
alter table public.oda_mesajlari enable row level security;

-- iki kişi yoldaş mı (herhangi bir yönde onaylı)
create or replace function public.yoldas_mi(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.yoldasliklar where durum = 'onayli'
                  and ((takip_eden = a and takip_edilen = b) or (takip_eden = b and takip_edilen = a)));
$$;

create or replace function public.oda_uyesi_mi(p_oda uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.oda_uyeleri where oda = p_oda and kisi = (select auth.uid()));
$$;

create or replace function public.oda_sistem(p_oda uuid, p_metin text)
returns void language sql security definer set search_path = '' as $$
  insert into public.oda_mesajlari (oda, gonderen, icerik, tur) values (p_oda, (select auth.uid()), left(p_metin, 300), 'sistem');
  update public.odalar set son_mesaj = now() where id = p_oda;
$$;

create or replace function public.oda_kur(p_ad text, p_uyeler uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v_oda uuid; v_isim text; u uuid; n int := 0;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if (select uzak or uzlet or (susturma_bitis is not null and susturma_bitis > now()) from public.profiller where id = v_ben) then raise exception 'susturuldun'; end if;
  if char_length(btrim(coalesce(p_ad, ''))) not between 2 and 40 then raise exception 'oda_adi'; end if;
  if (select count(*) from public.oda_uyeleri where kisi = v_ben and rol = 'kurucu') >= 20 then raise exception 'oda_cok'; end if;
  insert into public.odalar (ad, kurucu) values (btrim(p_ad), v_ben) returning id into v_oda;
  insert into public.oda_uyeleri (oda, kisi, rol) values (v_oda, v_ben, 'kurucu');
  foreach u in array coalesce(p_uyeler, '{}') loop
    exit when n >= 49;
    if u <> v_ben and public.yoldas_mi(v_ben, u) and not exists (select 1 from public.profiller where id = u and (uzak or uzlet)) then
      insert into public.oda_uyeleri (oda, kisi) values (v_oda, u) on conflict do nothing;
      n := n + 1;
    end if;
  end loop;
  select isim into v_isim from public.profiller where id = v_ben;
  perform public.oda_sistem(v_oda, v_isim || ' "' || btrim(p_ad) || '" meclis odasını kurdu.');
  return v_oda;
end $$;

create or replace function public.odalarim()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'ad', o.ad, 'son_mesaj', o.son_mesaj,
      'uye_sayisi', (select count(*) from public.oda_uyeleri x where x.oda = o.id),
      'uyeler', (select jsonb_agg(public.profil_json(p)) from (select p.* from public.oda_uyeleri x join public.profiller p on p.id = x.kisi
                   where x.oda = o.id and x.kisi <> (select auth.uid()) order by x.katilma limit 3) p),
      'son', (select jsonb_build_object('icerik', m.icerik, 'tur', m.tur, 'olusturma', m.olusturma,
                'isim', (select p.isim from public.profiller p where p.id = m.gonderen), 'benden', m.gonderen = (select auth.uid()))
                from public.oda_mesajlari m where m.oda = o.id order by m.id desc limit 1),
      'okunmamis', (select count(*) from public.oda_mesajlari m where m.oda = o.id and m.id > u.son_okunan
                      and m.gonderen is distinct from (select auth.uid()) and m.tur = 'mesaj'))
      order by o.son_mesaj desc), '[]'::jsonb)
  from public.oda_uyeleri u join public.odalar o on o.id = u.oda
  where u.kisi = (select auth.uid());
$$;

create or replace function public.oda_getir(p_oda uuid, p_once bigint, p_limit integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v jsonb; v_son bigint;
begin
  if not public.oda_uyesi_mi(p_oda) then raise exception 'oda_yok'; end if;
  select max(id) into v_son from public.oda_mesajlari where oda = p_oda;
  if v_son is not null and p_once is null then
    update public.oda_uyeleri set son_okunan = v_son where oda = p_oda and kisi = v_ben and son_okunan < v_son;
  end if;
  select jsonb_build_object(
    'oda', (select jsonb_build_object('id', o.id, 'ad', o.ad, 'olusturma', o.olusturma, 'kurucu', o.kurucu,
              'ben_kurucu', o.kurucu = v_ben) from public.odalar o where o.id = p_oda),
    'uyeler', (select jsonb_agg(public.profil_json(p) || jsonb_build_object('oda_rol', x.rol) order by (x.rol = 'kurucu') desc, x.katilma)
                 from public.oda_uyeleri x join public.profiller p on p.id = x.kisi where x.oda = p_oda),
    'mesajlar', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'icerik', m.icerik, 'tur', m.tur, 'olusturma', m.olusturma,
        'benden', m.gonderen = v_ben, 'kisi', (select public.profil_json(p) from public.profiller p where p.id = m.gonderen)) order by m.id)
      from (select * from public.oda_mesajlari where oda = p_oda and (p_once is null or id < p_once)
             order by id desc limit least(greatest(coalesce(p_limit, 60), 1), 100)) m), '[]'::jsonb))
  into v;
  return v;
end $$;

create or replace function public.oda_mesaj_gonder(p_oda uuid, p_icerik text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); m public.oda_mesajlari; v_icerik text := btrim(coalesce(p_icerik, ''));
begin
  if not public.oda_uyesi_mi(p_oda) then raise exception 'oda_yok'; end if;
  if char_length(v_icerik) = 0 then raise exception 'bos_mesaj'; end if;
  if (select count(*) from public.oda_mesajlari where gonderen = v_ben and olusturma > now() - interval '1 minute') >= 40 then raise exception 'cok_hizli'; end if;
  insert into public.oda_mesajlari (oda, gonderen, icerik) values (p_oda, v_ben, left(v_icerik, 2000)) returning * into m;
  update public.odalar set son_mesaj = now() where id = p_oda;
  update public.oda_uyeleri set son_okunan = m.id where oda = p_oda and kisi = v_ben;
  return jsonb_build_object('id', m.id, 'icerik', m.icerik, 'tur', m.tur, 'olusturma', m.olusturma, 'benden', true,
    'kisi', (select public.profil_json(p) from public.profiller p where p.id = v_ben));
end $$;

create or replace function public.oda_uye_ekle(p_oda uuid, p_kisiler uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); u uuid; n int := 0; v_isim text;
begin
  if not exists (select 1 from public.odalar where id = p_oda and kurucu = v_ben) then raise exception 'yetki_yok'; end if;
  foreach u in array coalesce(p_kisiler, '{}') loop
    exit when (select count(*) from public.oda_uyeleri where oda = p_oda) >= 50;
    if public.yoldas_mi(v_ben, u) and not exists (select 1 from public.oda_uyeleri where oda = p_oda and kisi = u)
       and not exists (select 1 from public.profiller where id = u and (uzak or uzlet)) then
      insert into public.oda_uyeleri (oda, kisi) values (p_oda, u);
      select isim into v_isim from public.profiller where id = u;
      perform public.oda_sistem(p_oda, v_isim || ' odaya katıldı.');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.oda_uye_cikar(p_oda uuid, p_kisi uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v_isim text;
begin
  if not exists (select 1 from public.odalar where id = p_oda and kurucu = v_ben) or p_kisi = v_ben then raise exception 'yetki_yok'; end if;
  delete from public.oda_uyeleri where oda = p_oda and kisi = p_kisi;
  if found then
    select isim into v_isim from public.profiller where id = p_kisi;
    perform public.oda_sistem(p_oda, v_isim || ' odadan çıkarıldı.');
  end if;
  return found;
end $$;

create or replace function public.oda_ayril(p_oda uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v_isim text; v_yeni uuid;
begin
  if not public.oda_uyesi_mi(p_oda) then raise exception 'oda_yok'; end if;
  select isim into v_isim from public.profiller where id = v_ben;
  delete from public.oda_uyeleri where oda = p_oda and kisi = v_ben;
  if not exists (select 1 from public.oda_uyeleri where oda = p_oda) then
    delete from public.odalar where id = p_oda;
    return true;
  end if;
  if (select kurucu from public.odalar where id = p_oda) = v_ben then
    select kisi into v_yeni from public.oda_uyeleri where oda = p_oda order by katilma limit 1;
    update public.odalar set kurucu = v_yeni where id = p_oda;
    update public.oda_uyeleri set rol = 'kurucu' where oda = p_oda and kisi = v_yeni;
  end if;
  insert into public.oda_mesajlari (oda, gonderen, icerik, tur) values (p_oda, null, v_isim || ' odadan ayrıldı.', 'sistem');
  update public.odalar set son_mesaj = now() where id = p_oda;
  return true;
end $$;

create or replace function public.oda_duzenle(p_oda uuid, p_ad text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid());
begin
  if not exists (select 1 from public.odalar where id = p_oda and kurucu = v_ben) then raise exception 'yetki_yok'; end if;
  if char_length(btrim(coalesce(p_ad, ''))) not between 2 and 40 then raise exception 'oda_adi'; end if;
  update public.odalar set ad = btrim(p_ad) where id = p_oda;
  perform public.oda_sistem(p_oda, 'Odanın adı "' || btrim(p_ad) || '" oldu.');
  return true;
end $$;

-- susturulan/uzaklaştırılan oda mesajı da yazamasın
create or replace function public.ceza_denetle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_kisi uuid; r record; j jsonb := to_jsonb(new);
begin
  if tg_table_name = 'oda_mesajlari' and j ->> 'tur' = 'sistem' then return new; end if;
  v_kisi := (j ->> case tg_table_name
    when 'kelamlar' then 'yazar'
    when 'mesajlar' then 'gonderen'
    when 'oda_mesajlari' then 'gonderen'
    when 'tasdikler' then 'kisi_id'
    when 'yoldasliklar' then 'takip_eden'
    when 'sikayetler' then 'bildiren'
  end)::uuid;
  select uzak, susturma_bitis into r from public.profiller where id = v_kisi;
  if r.uzak then raise exception 'uzaklastirildin'; end if;
  if tg_table_name in ('kelamlar', 'mesajlar', 'oda_mesajlari') and r.susturma_bitis > now() then
    raise exception 'susturuldun';
  end if;
  return new;
end $$;
drop trigger if exists erkam_ceza on public.oda_mesajlari;
create trigger erkam_ceza before insert on public.oda_mesajlari for each row execute function public.ceza_denetle();

-- oda mesajı bildirimi
create or replace function public.oda_ulak_tetikle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tur <> 'mesaj' then return null; end if;
  if not exists (select 1 from public.cihazlar c join public.oda_uyeleri u on u.kisi = c.kullanici
                  where u.oda = new.oda and u.kisi is distinct from new.gonderen) then return null; end if;
  perform net.http_post(
    url := 'https://xzbprcsiwaoxcmzklayu.supabase.co/functions/v1/ulak-bildirim',
    body := jsonb_build_object('tur', 'oda', 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 8000);
  return null;
exception when others then
  return null;
end $$;
drop trigger if exists oda_ulak on public.oda_mesajlari;
create trigger oda_ulak after insert on public.oda_mesajlari for each row execute function public.oda_ulak_tetikle();

create or replace function public.ulak_icerik(p_tur text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v jsonb; n int;
begin
  if p_tur = 'bildirim' then
    select b.tur, b.alici, b.kelam_id, b.olusturma, b.metin as bmetin, p.isim, p.kunye, p.avatar_yol, left(k.icerik, 140) as metin
      into r from public.bildirimler b
      left join public.profiller p on p.id = b.kimden
      left join public.kelamlar k on k.id = b.kelam_id
      where b.id = p_id;
    if not found or r.olusturma < now() - interval '3 minutes' or r.tur = 'hosgeldin' then return null; end if;
    v := jsonb_build_object('tur', r.tur, 'alici', r.alici, 'kelam', r.kelam_id, 'isim', r.isim, 'kunye', r.kunye,
      'avatar', r.avatar_yol, 'metin', coalesce(r.bmetin, r.metin),
      'okunmamis', (select count(*) from public.bildirimler where alici = r.alici and not okundu));
  elsif p_tur = 'mesaj' then
    select m.alici, m.icerik, m.olusturma, p.isim, p.kunye, p.avatar_yol into r
      from public.mesajlar m join public.profiller p on p.id = m.gonderen where m.id = p_id;
    if not found or r.olusturma < now() - interval '3 minutes' then return null; end if;
    v := jsonb_build_object('tur', 'mesaj', 'alici', r.alici, 'isim', r.isim, 'kunye', r.kunye,
      'avatar', r.avatar_yol, 'metin', left(r.icerik, 300));
  elsif p_tur = 'oda' then
    select m.oda, m.gonderen, m.icerik, m.olusturma, o.ad, p.isim, p.avatar_yol into r
      from public.oda_mesajlari m join public.odalar o on o.id = m.oda left join public.profiller p on p.id = m.gonderen
     where m.id = p_id and m.tur = 'mesaj';
    if not found or r.olusturma < now() - interval '3 minutes' then return null; end if;
    insert into public.ulak_gidenler (tur, id) values (p_tur, p_id) on conflict do nothing;
    get diagnostics n = row_count;
    if n = 0 then return null; end if;
    return jsonb_build_object('tur', 'oda', 'oda', r.oda, 'oda_ad', r.ad, 'isim', r.isim, 'avatar', r.avatar_yol, 'metin', left(r.icerik, 300),
      'tokenler', coalesce((select jsonb_agg(c.token) from public.cihazlar c join public.oda_uyeleri u on u.kisi = c.kullanici
                             where u.oda = r.oda and u.kisi is distinct from r.gonderen), '[]'::jsonb));
  else
    return null;
  end if;
  insert into public.ulak_gidenler (tur, id) values (p_tur, p_id) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return null; end if;
  delete from public.ulak_gidenler where zaman < now() - interval '1 day';
  return v || jsonb_build_object('tokenler',
    coalesce((select jsonb_agg(token) from public.cihazlar where kullanici = (v->>'alici')::uuid), '[]'::jsonb));
end $$;

-- ================= ben(): uzlet ve oda sayacı =================
create or replace function public.ben()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.profil_getir(p.kunye) || jsonb_build_object(
    'okunmamis_bildirim', (select count(*) from public.bildirimler b where b.alici = p.id and not b.okundu),
    'okunmamis_mesaj', (select count(*) from public.mesajlar m where m.alici = p.id and not m.okundu)
        + (select count(*) from public.oda_uyeleri u join public.oda_mesajlari m on m.oda = u.oda
            where u.kisi = p.id and m.id > u.son_okunan and m.tur = 'mesaj' and m.gonderen is distinct from p.id),
    'okunmamis_oda', (select count(*) from public.oda_uyeleri u join public.oda_mesajlari m on m.oda = u.oda
            where u.kisi = p.id and m.id > u.son_okunan and m.tur = 'mesaj' and m.gonderen is distinct from p.id),
    'onayli', p.onayli, 'uzak', p.uzak, 'uzlet', p.uzlet,
    'susturma_bitis', case when p.susturma_bitis > now() then p.susturma_bitis end,
    'emanet_surum', p.emanet_surum, 'emanet_tarih', p.emanet_tarih, 'dogum_var', exists (select 1 from public.profil_gizli g where g.id = p.id and g.dogum_tarihi is not null),
    'genc', coalesce((select age(current_date, g.dogum_tarihi) < interval '18 years' from public.profil_gizli g where g.id = p.id), false),
    'bekleyen_sikayet', case when p.rol = 'yonetim' then (select count(*) from public.sikayetler s where s.durum = 'yeni') end,
    'bekleyen_basvuru', case when p.rol = 'yonetim' then (select count(*) from public.basvurular s where s.durum = 'yeni') end)
    from public.profiller p where p.id = (select auth.uid());
$$;

-- ================= Yetkiler =================
revoke all on function public.kelam_nakil(uuid), public.kelam_tadil(uuid, text, text[]), public.kelam_goruldu(uuid[]), public.kelam_seckin(uuid),
  public.uzlete_cekil(), public.uzletten_don(), public.oda_kur(text, uuid[]), public.odalarim(), public.oda_getir(uuid, bigint, integer),
  public.oda_mesaj_gonder(uuid, text), public.oda_uye_ekle(uuid, uuid[]), public.oda_uye_cikar(uuid, uuid), public.oda_ayril(uuid),
  public.oda_duzenle(uuid, text), public.oda_sistem(uuid, text), public.yoldas_mi(uuid, uuid), public.oda_uyesi_mi(uuid),
  public.kelam_nakset(text, text, text[], text, uuid, jsonb, uuid) from public, anon;
grant execute on function public.kelam_nakil(uuid), public.kelam_tadil(uuid, text, text[]), public.kelam_goruldu(uuid[]), public.kelam_seckin(uuid),
  public.uzlete_cekil(), public.uzletten_don(), public.oda_kur(text, uuid[]), public.odalarim(), public.oda_getir(uuid, bigint, integer),
  public.oda_mesaj_gonder(uuid, text), public.oda_uye_ekle(uuid, uuid[]), public.oda_uye_cikar(uuid, uuid), public.oda_ayril(uuid),
  public.oda_duzenle(uuid, text), public.yoldas_mi(uuid, uuid), public.oda_uyesi_mi(uuid),
  public.kelam_nakset(text, text, text[], text, uuid, jsonb, uuid) to authenticated;
revoke all on function public.oda_sistem(uuid, text) from authenticated;

-- ================= Doğum tarihini kapalı tabloya taşı =================
create or replace function public.emanet_onayla(p_surum int, p_dogum date, p_onaylar jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v_yas int;
  v_ilk boolean;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  select emanet_surum = 0 into v_ilk from public.profiller where id = v_ben;
  p_dogum := coalesce(p_dogum, (select dogum_tarihi from public.profil_gizli where id = v_ben));
  if p_dogum is null or p_dogum > current_date or p_dogum < date '1900-01-01' then raise exception 'dogum_gecersiz'; end if;
  v_yas := extract(year from age(current_date, p_dogum))::int;
  if v_yas < 15 then raise exception 'yas_kucuk'; end if;
  if not (coalesce((p_onaylar->>'sartlar')::boolean,false) and coalesce((p_onaylar->>'aydinlatma')::boolean,false)) then
    raise exception 'onay_eksik';
  end if;
  insert into public.profil_gizli (id, dogum_tarihi) values (v_ben, p_dogum)
    on conflict (id) do update set dogum_tarihi = excluded.dogum_tarihi;
  update public.profiller set emanet_surum = p_surum, emanet_tarih = now(),
    izole = case when v_yas < 18 and v_ilk then true else izole end
    where id = v_ben;
  insert into public.emanet_kayitlari (kisi, surum, onaylar) values (v_ben, p_surum, p_onaylar || jsonb_build_object('yas_grubu', case when v_yas < 18 then '15-17' else '18+' end));
  return jsonb_build_object('surum', p_surum, 'genc', v_yas < 18);
end $$;

-- verilerim: doğum tarihi kapalı tablodan
do $$
declare d text := pg_get_functiondef('public.verilerim()'::regprocedure);
begin
  d := replace(d, $q$(select to_jsonb(p) - 'id' from public.profiller p where p.id = v_ben)$q$,
    $q$(select (to_jsonb(p) - 'id') || jsonb_build_object('dogum_tarihi', (select g.dogum_tarihi from public.profil_gizli g where g.id = v_ben)) from public.profiller p where p.id = v_ben)$q$);
  execute d;
end $$;

alter table public.profiller drop column if exists dogum_tarihi;

-- yeni sütunlara ekleme yetkisi
grant insert (nakil_id, iktibas_id) on public.kelamlar to authenticated;
