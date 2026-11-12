-- 012: İstişare (anket) — akışta ve meclis odalarında
create table if not exists public.istisareler (
  id uuid primary key default gen_random_uuid(),
  kelam_id uuid unique references public.kelamlar(id) on delete cascade,
  oda_mesaj bigint unique references public.oda_mesajlari(id) on delete cascade,
  sahip uuid not null references public.profiller(id) on delete cascade,
  secenekler text[] not null check (array_length(secenekler, 1) between 2 and 4),
  bitis timestamptz not null,
  olusturma timestamptz not null default now(),
  check ((kelam_id is null) <> (oda_mesaj is null))
);
create table if not exists public.istisare_oylari (
  istisare uuid not null references public.istisareler(id) on delete cascade,
  kisi uuid not null references public.profiller(id) on delete cascade,
  secim smallint not null,
  olusturma timestamptz not null default now(),
  primary key (istisare, kisi)
);
alter table public.istisareler enable row level security;
alter table public.istisare_oylari enable row level security;
-- doğrudan erişim yok; yalnızca aşağıdaki işlevler

create or replace function public.istisare_gorebilir(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.istisareler i
      left join public.kelamlar k on k.id = i.kelam_id
      left join public.oda_mesajlari m on m.id = i.oda_mesaj
     where i.id = p_id
       and ((k.id is not null and public.gorebilir(k.yazar))
         or (m.id is not null and public.oda_uyesi_mi(m.oda))));
$$;

create or replace function public.istisare_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not public.istisare_gorebilir(p_id) then null else (
    select jsonb_build_object(
      'id', i.id, 'secenekler', to_jsonb(i.secenekler), 'bitis', i.bitis, 'bitti', i.bitis <= now(),
      'sayilar', (select jsonb_agg((select count(*) from public.istisare_oylari o where o.istisare = i.id and o.secim = g) order by g)
                    from generate_series(0, array_length(i.secenekler, 1) - 1) g),
      'toplam', (select count(*) from public.istisare_oylari o where o.istisare = i.id),
      'benim', (select o.secim from public.istisare_oylari o where o.istisare = i.id and o.kisi = (select auth.uid())),
      'sahibim', i.sahip = (select auth.uid()))
    from public.istisareler i where i.id = p_id) end;
$$;

create or replace function public.istisare_kur(p_kelam uuid default null, p_oda_mesaj bigint default null, p_secenekler text[] default '{}', p_saat integer default 24)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v_sec text[]; v_id uuid; x text;
begin
  if v_ben is null then raise exception 'oturum_yok'; end if;
  v_sec := '{}';
  foreach x in array coalesce(p_secenekler, '{}') loop
    x := left(btrim(x), 60);
    if char_length(x) > 0 then v_sec := v_sec || x; end if;
  end loop;
  if coalesce(array_length(v_sec, 1), 0) not between 2 and 4 then raise exception 'istisare_secenek'; end if;
  if (p_kelam is null) = (p_oda_mesaj is null) then raise exception 'istisare_hedef'; end if;
  if p_kelam is not null and not exists (select 1 from public.kelamlar where id = p_kelam and yazar = v_ben
       and ust_id is null and nakil_id is null and olusturma > now() - interval '10 minutes') then raise exception 'yetki_yok'; end if;
  if p_oda_mesaj is not null and not exists (select 1 from public.oda_mesajlari where id = p_oda_mesaj and gonderen = v_ben
       and tur = 'mesaj' and olusturma > now() - interval '10 minutes') then raise exception 'yetki_yok'; end if;
  insert into public.istisareler (kelam_id, oda_mesaj, sahip, secenekler, bitis)
  values (p_kelam, p_oda_mesaj, v_ben, v_sec, now() + make_interval(hours => least(greatest(coalesce(p_saat, 24), 1), 168)))
  returning id into v_id;
  return public.istisare_json(v_id);
end $$;

create or replace function public.istisare_oyla(p_id uuid, p_secim integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); i public.istisareler;
begin
  if v_ben is null then raise exception 'oturum_yok'; end if;
  if not public.istisare_gorebilir(p_id) then raise exception 'istisare_yok'; end if;
  select * into i from public.istisareler where id = p_id;
  if i.bitis <= now() then raise exception 'istisare_bitti'; end if;
  if p_secim is null or p_secim < 0 or p_secim >= array_length(i.secenekler, 1) then raise exception 'istisare_secenek'; end if;
  insert into public.istisare_oylari (istisare, kisi, secim) values (p_id, v_ben, p_secim)
  on conflict (istisare, kisi) do nothing;
  return public.istisare_json(p_id);
end $$;

create or replace function public.istisare_kelam(p_kelam uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.istisare_json(i.id) from public.istisareler i where i.kelam_id = p_kelam;
$$;

revoke all on function public.istisare_kur(uuid, bigint, text[], integer) from public, anon;
revoke all on function public.istisare_oyla(uuid, integer) from public, anon;
grant execute on function public.istisare_kur(uuid, bigint, text[], integer) to authenticated;
grant execute on function public.istisare_oyla(uuid, integer) to authenticated;

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
         from public.kelamlar q where q.id = k.iktibas_id), '{"silindi": true}'::jsonb) end,
    'istisare', public.istisare_kelam(k.id))
  end;
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
        'benden', m.gonderen = v_ben,
        'istisare', (select public.istisare_json(i.id) from public.istisareler i where i.oda_mesaj = m.id), 'kisi', (select public.profil_json(p) from public.profiller p where p.id = m.gonderen)) order by m.id)
      from (select * from public.oda_mesajlari where oda = p_oda and (p_once is null or id < p_once)
             order by id desc limit least(greatest(coalesce(p_limit, 60), 1), 100)) m), '[]'::jsonb))
  into v;
  return v;
end $$;
