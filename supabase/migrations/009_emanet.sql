-- ERKAM — Emanet ve Hukuk: KVKK onayı, yaş beyanı, veri indirme, KVKK başvurusu, ayrılmış künyeler

-- ---------- profil alanları ----------
alter table public.profiller
  add column if not exists dogum_tarihi date,
  add column if not exists emanet_surum int not null default 0,
  add column if not exists emanet_tarih timestamptz;

-- onay kayıtları (ispat için; silinmez, hesap silinince kişi bağı kalkar)
create table if not exists public.emanet_kayitlari (
  id bigserial primary key,
  kisi uuid references public.profiller(id) on delete set null,
  surum int not null,
  onaylar jsonb not null,
  zaman timestamptz not null default now()
);
alter table public.emanet_kayitlari enable row level security;
drop policy if exists emanet_kendi on public.emanet_kayitlari;
create policy emanet_kendi on public.emanet_kayitlari for select to authenticated using (kisi = (select auth.uid()));

-- KVKK başvuruları
create table if not exists public.basvurular (
  id bigserial primary key,
  kisi uuid references public.profiller(id) on delete set null,
  tur text not null check (tur in ('bilgi','duzeltme','silme','itiraz','tazmin','diger')),
  metin text not null check (char_length(metin) between 10 and 2000),
  durum text not null default 'yeni' check (durum in ('yeni','cevaplandi')),
  cevap text,
  olusturma timestamptz not null default now(),
  kapanma timestamptz
);
alter table public.basvurular enable row level security;
drop policy if exists basvuru_kendi on public.basvurular;
create policy basvuru_kendi on public.basvurular for select to authenticated using (kisi = (select auth.uid()));

-- ---------- ayrılmış künyeler ----------
create or replace function public.kunye_ayrilmis(p_kunye text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(coalesce(p_kunye,'')) = any (array['erkam','erkammeclisi','erkam_meclisi','erkamresmi','erkam_resmi','resmi','yonetim','yonetici',
    'admin','administrator','moderator','mod','destek','yardim','sistem','system','root','kvkk','hukuk','duyuru','meclis','darulerkam','dar_ul_erkam'])
$$;

create or replace function public.kunye_korumasi()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.kunye_ayrilmis(new.kunye) and (tg_op = 'INSERT' or new.kunye is distinct from old.kunye) then
    -- yalnızca resmî ERKAM e-postası "erkam" künyesini, yönetim de diğer ayrılmışları alabilir
    if not ((new.kunye = 'erkam' and exists (select 1 from auth.users u where u.id = new.id and lower(u.email) = 'erkamsocialmedya@gmail.com'))
            or coalesce(new.rol,'') = 'yonetim') then
      raise exception 'kunye_ayrilmis';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists kunye_korumasi on public.profiller;
create trigger kunye_korumasi before insert or update of kunye on public.profiller
  for each row execute function public.kunye_korumasi();

create or replace function public.kunye_musait(p_kunye text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce(p_kunye, '')) ~ '^[a-z0-9_]{3,20}$'
     and (lower(p_kunye) = 'erkam' or not public.kunye_ayrilmis(p_kunye))  -- 'erkam' kayıtta e-postayla denetlenir
     and not exists (select 1 from public.profiller where kunye = lower(p_kunye));
$$;

create or replace function public.yeni_kullanici()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_kunye text := lower(coalesce(new.raw_user_meta_data ->> 'kunye', ''));
  v_isim text := btrim(coalesce(new.raw_user_meta_data ->> 'isim', ''));
  v_yedek text := 'yoldas_' || substr(replace(new.id::text, '-', ''), 1, 10);
begin
  if v_kunye !~ '^[a-z0-9_]{3,20}$' or exists (select 1 from public.profiller where kunye = v_kunye)
     or (public.kunye_ayrilmis(v_kunye) and not (v_kunye = 'erkam' and lower(new.email) = 'erkamsocialmedya@gmail.com')) then
    v_kunye := v_yedek;
  end if;
  if char_length(v_isim) < 2 or char_length(v_isim) > 40 then
    v_isim := 'Yoldaş';
  end if;
  begin
    insert into public.profiller (id, kunye, isim) values (new.id, v_kunye, v_isim);
  exception when unique_violation then
    insert into public.profiller (id, kunye, isim) values (new.id, v_yedek, v_isim);
  end;
  insert into public.bildirimler (alici, tur) values (new.id, 'hosgeldin');
  return new;
end $$;

-- ---------- emanet onayı ----------
create or replace function public.emanet_onayla(p_surum int, p_dogum date, p_onaylar jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v_yas int;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if p_dogum is null or p_dogum > current_date or p_dogum < date '1900-01-01' then raise exception 'dogum_gecersiz'; end if;
  v_yas := extract(year from age(current_date, p_dogum))::int;
  if v_yas < 15 then raise exception 'yas_kucuk'; end if;
  if not (coalesce((p_onaylar->>'sartlar')::boolean,false) and coalesce((p_onaylar->>'aydinlatma')::boolean,false)) then
    raise exception 'onay_eksik';
  end if;
  update public.profiller set dogum_tarihi = p_dogum, emanet_surum = p_surum, emanet_tarih = now(),
    izole = case when v_yas < 18 and emanet_surum = 0 then true else izole end
    where id = v_ben;
  insert into public.emanet_kayitlari (kisi, surum, onaylar) values (v_ben, p_surum, p_onaylar || jsonb_build_object('yas_grubu', case when v_yas < 18 then '15-17' else '18+' end));
  return jsonb_build_object('surum', p_surum, 'genc', v_yas < 18);
end $$;

-- ---------- ben(): emanet bilgisi ----------
create or replace function public.ben()
returns jsonb language sql stable set search_path = '' as $$
  select public.profil_getir(p.kunye) || jsonb_build_object(
    'okunmamis_bildirim', (select count(*) from public.bildirimler b where b.alici = p.id and not b.okundu),
    'okunmamis_mesaj', (select count(*) from public.mesajlar m where m.alici = p.id and not m.okundu),
    'onayli', p.onayli, 'uzak', p.uzak,
    'susturma_bitis', case when p.susturma_bitis > now() then p.susturma_bitis end,
    'emanet_surum', p.emanet_surum, 'emanet_tarih', p.emanet_tarih,
    'genc', case when p.dogum_tarihi is not null then age(current_date, p.dogum_tarihi) < interval '18 years' else false end,
    'bekleyen_sikayet', case when p.rol = 'yonetim' then (select count(*) from public.sikayetler s where s.durum = 'yeni') end,
    'bekleyen_basvuru', case when p.rol = 'yonetim' then (select count(*) from public.basvurular s where s.durum = 'yeni') end)
    from public.profiller p where p.id = (select auth.uid());
$$;

-- ---------- verilerim: tüm verinin dökümü ----------
create or replace function public.verilerim()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid());
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  return jsonb_build_object(
    'olusturma', now(),
    'aciklama', 'ERKAM — KVKK m.11 kapsamında kişisel verilerinin dökümü',
    'hesap', (select jsonb_build_object('eposta', u.email, 'kayit', u.created_at, 'son_giris', u.last_sign_in_at) from auth.users u where u.id = v_ben),
    'profil', (select to_jsonb(p) - 'id' from public.profiller p where p.id = v_ben),
    'kelamlar', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'icerik', k.icerik, 'muhurler', k.muhurler, 'gorsel', k.gorsel_yol, 'medya', k.medya, 'ust_id', k.ust_id, 'tarih', k.olusturma) order by k.olusturma) from public.kelamlar k where k.yazar = v_ben), '[]'),
    'mesajlar', coalesce((select jsonb_agg(jsonb_build_object('yon', case when m.gonderen = v_ben then 'giden' else 'gelen' end,
        'karsi', (select '@' || q.kunye from public.profiller q where q.id = case when m.gonderen = v_ben then m.alici else m.gonderen end),
        'icerik', m.icerik, 'tarih', m.olusturma) order by m.olusturma) from public.mesajlar m where m.gonderen = v_ben or m.alici = v_ben), '[]'),
    'yoldasliklar', coalesce((select jsonb_agg(jsonb_build_object('yon', case when y.takip_eden = v_ben then 'edindigi' else 'yoldasi' end,
        'kisi', (select '@' || q.kunye from public.profiller q where q.id = case when y.takip_eden = v_ben then y.takip_edilen else y.takip_eden end),
        'durum', y.durum, 'tarih', y.olusturma)) from public.yoldasliklar y where y.takip_eden = v_ben or y.takip_edilen = v_ben), '[]'),
    'tasdikler', coalesce((select jsonb_agg(jsonb_build_object('kelam', t.kelam_id, 'tarih', t.olusturma)) from public.tasdikler t where t.kisi_id = v_ben), '[]'),
    'heybe', coalesce((select jsonb_agg(jsonb_build_object('kelam', h.kelam_id, 'tarih', h.olusturma)) from public.heybe h where h.kisi_id = v_ben), '[]'),
    'sikayetlerim', coalesce((select jsonb_agg(jsonb_build_object('sebep', s.sebep, 'durum', s.durum, 'tarih', s.olusturma)) from public.sikayetler s where s.bildiren = v_ben), '[]'),
    'suffe_ilerleme', coalesce((select jsonb_agg(jsonb_build_object('ders', i.ders_id, 'yuzde', i.yuzde)) from public.suffe_ilerleme i where i.kisi_id = v_ben), '[]'),
    'bildirim_cihazlari', (select count(*) from public.cihazlar c where c.kullanici = v_ben),
    'emanet_onaylari', coalesce((select jsonb_agg(jsonb_build_object('surum', e.surum, 'onaylar', e.onaylar, 'tarih', e.zaman)) from public.emanet_kayitlari e where e.kisi = v_ben), '[]'),
    'kvkk_basvurulari', coalesce((select jsonb_agg(jsonb_build_object('tur', b.tur, 'metin', b.metin, 'durum', b.durum, 'cevap', b.cevap, 'tarih', b.olusturma)) from public.basvurular b where b.kisi = v_ben), '[]')
  );
end $$;

-- ---------- KVKK başvurusu ----------
create or replace function public.kvkk_basvur(p_tur text, p_metin text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v_id bigint;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if (select count(*) from public.basvurular where kisi = v_ben and durum = 'yeni') >= 3 then raise exception 'basvuru_cok'; end if;
  insert into public.basvurular (kisi, tur, metin) values (v_ben, p_tur, btrim(p_metin)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.basvurularim()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'tur', b.tur, 'metin', b.metin, 'durum', b.durum, 'cevap', b.cevap, 'tarih', b.olusturma, 'kapanma', b.kapanma) order by b.olusturma desc), '[]')
  from public.basvurular b where b.kisi = (select auth.uid());
$$;

create or replace function public.yonetim_basvurular(p_durum text default 'yeni')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetim_mi() then raise exception 'yetki_yok'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'tur', b.tur, 'metin', b.metin, 'durum', b.durum, 'cevap', b.cevap,
      'tarih', b.olusturma, 'kapanma', b.kapanma, 'kisi', case when p.id is not null then public.profil_json(p) end,
      'eposta', (select u.email from auth.users u where u.id = b.kisi)) order by b.olusturma desc)
    from public.basvurular b left join public.profiller p on p.id = b.kisi
    where p_durum = 'hepsi' or b.durum = p_durum), '[]');
end $$;

create or replace function public.yonetim_basvuru_cevapla(p_id bigint, p_cevap text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_kisi uuid;
begin
  if not public.yonetim_mi() then raise exception 'yetki_yok'; end if;
  if char_length(btrim(coalesce(p_cevap,''))) < 5 then raise exception 'cevap_kisa'; end if;
  update public.basvurular set durum = 'cevaplandi', cevap = btrim(p_cevap), kapanma = now() where id = p_id returning kisi into v_kisi;
  if v_kisi is not null then
    insert into public.bildirimler (alici, kimden, tur, metin) values (v_kisi, (select auth.uid()), 'uyari', 'KVKK başvurun cevaplandı: ' || left(btrim(p_cevap), 400));
  end if;
  return true;
end $$;

revoke all on function public.emanet_onayla(int, date, jsonb), public.verilerim(), public.kvkk_basvur(text, text), public.basvurularim(),
  public.yonetim_basvurular(text), public.yonetim_basvuru_cevapla(bigint, text) from public, anon;
grant execute on function public.emanet_onayla(int, date, jsonb), public.verilerim(), public.kvkk_basvur(text, text), public.basvurularim(),
  public.yonetim_basvurular(text), public.yonetim_basvuru_cevapla(bigint, text) to authenticated;

-- ---------- güncelleme: metin sürümü değişince doğum tarihi yeniden istenmez ----------
create or replace function public.emanet_onayla(p_surum int, p_dogum date, p_onaylar jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v_yas int;
  v_ilk boolean;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  select emanet_surum = 0, coalesce(p_dogum, dogum_tarihi) into v_ilk, p_dogum from public.profiller where id = v_ben;
  if p_dogum is null or p_dogum > current_date or p_dogum < date '1900-01-01' then raise exception 'dogum_gecersiz'; end if;
  v_yas := extract(year from age(current_date, p_dogum))::int;
  if v_yas < 15 then raise exception 'yas_kucuk'; end if;
  if not (coalesce((p_onaylar->>'sartlar')::boolean,false) and coalesce((p_onaylar->>'aydinlatma')::boolean,false)) then
    raise exception 'onay_eksik';
  end if;
  update public.profiller set dogum_tarihi = p_dogum, emanet_surum = p_surum, emanet_tarih = now(),
    izole = case when v_yas < 18 and v_ilk then true else izole end
    where id = v_ben;
  insert into public.emanet_kayitlari (kisi, surum, onaylar) values (v_ben, p_surum, p_onaylar || jsonb_build_object('yas_grubu', case when v_yas < 18 then '15-17' else '18+' end));
  return jsonb_build_object('surum', p_surum, 'genc', v_yas < 18);
end $$;
create or replace function public.ben()
returns jsonb language sql stable set search_path = '' as $$
  select public.profil_getir(p.kunye) || jsonb_build_object(
    'okunmamis_bildirim', (select count(*) from public.bildirimler b where b.alici = p.id and not b.okundu),
    'okunmamis_mesaj', (select count(*) from public.mesajlar m where m.alici = p.id and not m.okundu),
    'onayli', p.onayli, 'uzak', p.uzak,
    'susturma_bitis', case when p.susturma_bitis > now() then p.susturma_bitis end,
    'emanet_surum', p.emanet_surum, 'emanet_tarih', p.emanet_tarih, 'dogum_var', p.dogum_tarihi is not null,
    'genc', case when p.dogum_tarihi is not null then age(current_date, p.dogum_tarihi) < interval '18 years' else false end,
    'bekleyen_sikayet', case when p.rol = 'yonetim' then (select count(*) from public.sikayetler s where s.durum = 'yeni') end,
    'bekleyen_basvuru', case when p.rol = 'yonetim' then (select count(*) from public.basvurular s where s.durum = 'yeni') end)
    from public.profiller p where p.id = (select auth.uid());
$$;
