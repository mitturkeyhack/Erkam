-- 016: Engelleme ve sessize alma
create table if not exists public.engeller (
  engelleyen uuid not null references public.profiller(id) on delete cascade,
  engellenen uuid not null references public.profiller(id) on delete cascade,
  tur text not null check (tur in ('engel', 'sessiz')),
  olusturma timestamptz not null default now(),
  primary key (engelleyen, engellenen),
  check (engelleyen <> engellenen)
);
create index if not exists engeller_engellenen_idx on public.engeller (engellenen);
alter table public.engeller enable row level security;
-- doğrudan erişim yok; yalnızca aşağıdaki işlevler

-- a ile b arasında engel var mı (iki yönlü, yalnız 'engel')
create or replace function public.engelli_mi(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.engeller
                  where tur = 'engel' and ((engelleyen = a and engellenen = b) or (engelleyen = b and engellenen = a)));
$$;

-- görünürlük: engellediğim / sessize aldığım ya da beni engelleyen kişinin kelamları görünmez
create or replace function public.gorebilir(p_yazar uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_yazar = (select auth.uid())
      or public.yonetim_mi()
      or (not exists (select 1 from public.profiller where id = p_yazar and (uzak or uzlet))
          and not exists (select 1 from public.engeller e
                           where (e.engelleyen = (select auth.uid()) and e.engellenen = p_yazar)
                              or (e.engelleyen = p_yazar and e.engellenen = (select auth.uid()) and e.tur = 'engel'))
          and (not exists (select 1 from public.profiller where id = p_yazar and izole)
               or exists (select 1 from public.yoldasliklar
                           where takip_eden = (select auth.uid()) and takip_edilen = p_yazar and durum = 'onayli')));
$$;

create or replace function public.engel_durumu(p_kisi uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ben', (select tur from public.engeller where engelleyen = (select auth.uid()) and engellenen = p_kisi),
    'o', exists (select 1 from public.engeller where engelleyen = p_kisi and engellenen = (select auth.uid()) and tur = 'engel'));
$$;

create or replace function public.engelle(p_kisi uuid, p_tur text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid());
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if p_kisi is null or p_kisi = v_ben then raise exception 'kendin'; end if;
  if p_tur not in ('engel', 'sessiz') then raise exception 'gecersiz'; end if;
  if not exists (select 1 from public.profiller where id = p_kisi) then raise exception 'yoldas_yok'; end if;
  insert into public.engeller (engelleyen, engellenen, tur) values (v_ben, p_kisi, p_tur)
  on conflict (engelleyen, engellenen) do update set tur = excluded.tur, olusturma = now();
  if p_tur = 'engel' then
    delete from public.yoldasliklar where (takip_eden = v_ben and takip_edilen = p_kisi) or (takip_eden = p_kisi and takip_edilen = v_ben);
  end if;
  return public.engel_durumu(p_kisi);
end $$;

create or replace function public.engel_kaldir(p_kisi uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'giris_gerekli'; end if;
  delete from public.engeller where engelleyen = (select auth.uid()) and engellenen = p_kisi;
  return public.engel_durumu(p_kisi);
end $$;

create or replace function public.engellerim()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.profil_json(p) || jsonb_build_object('tur', e.tur, 'engel_tarih', e.olusturma) order by e.olusturma desc), '[]'::jsonb)
    from public.engeller e join public.profiller p on p.id = e.engellenen
   where e.engelleyen = (select auth.uid());
$$;

-- tetikleyiciler: mesaj, yoldaşlık, bildirim, oda üyeliği
create or replace function public.engel_mesaj() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.engelli_mi(new.gonderen, new.alici) then raise exception 'engelli'; end if;
  return new;
end $$;
drop trigger if exists engel_mesaj on public.mesajlar;
create trigger engel_mesaj before insert on public.mesajlar for each row execute function public.engel_mesaj();

create or replace function public.engel_yoldaslik() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.engelli_mi(new.takip_eden, new.takip_edilen) then raise exception 'engelli'; end if;
  return new;
end $$;
drop trigger if exists engel_yoldaslik on public.yoldasliklar;
create trigger engel_yoldaslik before insert on public.yoldasliklar for each row execute function public.engel_yoldaslik();

create or replace function public.engel_bildirim() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kimden is not null and new.kimden <> new.alici and exists (
       select 1 from public.engeller
        where (engelleyen = new.alici and engellenen = new.kimden)
           or (engelleyen = new.kimden and engellenen = new.alici and tur = 'engel')) then
    return null;  -- bildirim hiç oluşmaz (anlık bildirim de gitmez)
  end if;
  return new;
end $$;
drop trigger if exists engel_bildirim on public.bildirimler;
create trigger engel_bildirim before insert on public.bildirimler for each row execute function public.engel_bildirim();

create or replace function public.engel_oda_uye() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid());
begin
  if v_ben is not null and new.kisi <> v_ben and public.engelli_mi(v_ben, new.kisi) then return null; end if;
  return new;
end $$;
drop trigger if exists engel_oda_uye on public.oda_uyeleri;
create trigger engel_oda_uye before insert on public.oda_uyeleri for each row execute function public.engel_oda_uye();

-- profil_getir: engel durumunu da döndür
do $$
declare d text;
begin
  select pg_get_functiondef('public.profil_getir(text)'::regprocedure) into d;
  if position('engel_durumu' in d) > 0 then return; end if;
  d := replace(d, $r$'gorebilir', v_gor, 'uzlet', p.uzlet,$r$, $r$'gorebilir', v_gor, 'uzlet', p.uzlet, 'engel', case when p.id <> v_ben then public.engel_durumu(p.id) end,$r$);
  if position('engel_durumu' in d) = 0 then raise exception 'profil_getir degistirilemedi'; end if;
  execute d;
end $$;

revoke execute on function public.engel_mesaj() from public, anon, authenticated;
revoke execute on function public.engel_yoldaslik() from public, anon, authenticated;
revoke execute on function public.engel_bildirim() from public, anon, authenticated;
revoke execute on function public.engel_oda_uye() from public, anon, authenticated;
revoke execute on function public.engelle(uuid, text) from public, anon;
revoke execute on function public.engel_kaldir(uuid) from public, anon;
revoke execute on function public.engellerim() from public, anon;
revoke execute on function public.engel_durumu(uuid) from public, anon;
revoke execute on function public.engelli_mi(uuid, uuid) from public, anon;
grant execute on function public.engelle(uuid, text) to authenticated;
grant execute on function public.engel_kaldir(uuid) to authenticated;
grant execute on function public.engellerim() to authenticated;
grant execute on function public.engel_durumu(uuid) to authenticated;
grant execute on function public.engelli_mi(uuid, uuid) to authenticated;
