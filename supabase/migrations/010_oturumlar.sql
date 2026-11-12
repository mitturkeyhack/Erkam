-- ERKAM — Oturum açık cihazlar: cihaz bilgisi, oturum listesi, uzaktan oturum kapatma

create table if not exists public.oturum_cihazlari (
  oturum uuid primary key,
  kisi uuid not null references public.profiller(id) on delete cascade,
  marka text, model text, ad text, android text, surum text,
  guncelleme timestamptz not null default now()
);
alter table public.oturum_cihazlari enable row level security;

-- bildirim anahtarı hangi oturuma ait: oturum kapatılınca o telefona bildirim gitmesin
alter table public.cihazlar add column if not exists oturum uuid;

create or replace function public.simdiki_oturum()
returns uuid language sql stable set search_path = '' as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;

create or replace function public.oturum_kaydet(p_marka text, p_model text, p_ad text, p_android text, p_surum text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v_ot uuid := public.simdiki_oturum();
begin
  if v_ben is null or v_ot is null then return false; end if;
  insert into public.oturum_cihazlari (oturum, kisi, marka, model, ad, android, surum)
  values (v_ot, v_ben, left(p_marka, 40), left(p_model, 60), left(p_ad, 60), left(p_android, 20), left(p_surum, 20))
  on conflict (oturum) do update set marka = excluded.marka, model = excluded.model, ad = excluded.ad,
    android = excluded.android, surum = excluded.surum, guncelleme = now();
  -- artık var olmayan oturumların kayıtlarını temizle
  delete from public.oturum_cihazlari o where o.kisi = v_ben and not exists (select 1 from auth.sessions s where s.id = o.oturum);
  return true;
end $$;

create or replace function public.oturumlarim()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'bu', s.id = public.simdiki_oturum(),
      'acilis', s.created_at, 'son', greatest(s.updated_at, s.refreshed_at at time zone 'UTC', o.guncelleme),
      'ua', left(s.user_agent, 300), 'ip', host(s.ip),
      'marka', o.marka, 'model', o.model, 'ad', o.ad, 'android', o.android, 'surum', o.surum
    ) order by (s.id = public.simdiki_oturum()) desc, greatest(s.updated_at, s.refreshed_at at time zone 'UTC', o.guncelleme) desc), '[]')
  from auth.sessions s left join public.oturum_cihazlari o on o.oturum = s.id
  where s.user_id = (select auth.uid()) and (s.not_after is null or s.not_after > now());
$$;

create or replace function public.oturum_kapat(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid());
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if p_id = public.simdiki_oturum() then raise exception 'islem_gecersiz'; end if;
  delete from public.cihazlar where kullanici = v_ben and oturum = p_id;
  delete from public.oturum_cihazlari where kisi = v_ben and oturum = p_id;
  delete from auth.sessions where id = p_id and user_id = v_ben;
  return found;
end $$;

create or replace function public.diger_oturumlari_kapat()
returns int language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v_ot uuid := public.simdiki_oturum(); n int;
begin
  if v_ben is null or v_ot is null then raise exception 'giris_gerekli'; end if;
  delete from public.cihazlar where kullanici = v_ben and oturum is distinct from v_ot;
  delete from public.oturum_cihazlari where kisi = v_ben and oturum <> v_ot;
  delete from auth.sessions where user_id = v_ben and id <> v_ot;
  get diagnostics n = row_count;
  return n;
end $$;

-- bildirim anahtarını oturumla eşleştir
create or replace function public.cihaz_kaydet(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'giris_gerekli'; end if;
  if p_token is null or char_length(p_token) not between 20 and 4096 then raise exception 'token_gecersiz'; end if;
  insert into public.cihazlar (token, kullanici, oturum) values (p_token, (select auth.uid()), public.simdiki_oturum())
  on conflict (token) do update set kullanici = excluded.kullanici, oturum = excluded.oturum, guncelleme = now();
  delete from public.cihazlar where token in (
    select token from public.cihazlar where kullanici = (select auth.uid()) order by guncelleme desc offset 5);
end $$;

revoke all on function public.oturum_kaydet(text, text, text, text, text), public.oturumlarim(), public.oturum_kapat(uuid),
  public.diger_oturumlari_kapat() from public, anon;
grant execute on function public.oturum_kaydet(text, text, text, text, text), public.oturumlarim(), public.oturum_kapat(uuid),
  public.diger_oturumlari_kapat() to authenticated;
