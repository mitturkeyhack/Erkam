-- Anlık bildirim (Firebase Cloud Messaging)
-- Cihaz kayıtları + bildirim/mesaj eklenince Edge Function "ulak-bildirim" çağrılır.
create extension if not exists pg_net with schema extensions;

create table if not exists public.cihazlar (
  token text primary key,
  kullanici uuid not null references public.profiller(id) on delete cascade,
  guncelleme timestamptz not null default now()
);
create index if not exists cihazlar_kullanici_idx on public.cihazlar (kullanici);
alter table public.cihazlar enable row level security;
revoke all on public.cihazlar from anon, authenticated;

-- Cihazı (bu telefonu) bildirimler için kaydet / kaldır
create or replace function public.cihaz_kaydet(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'giris_gerekli'; end if;
  if p_token is null or char_length(p_token) not between 20 and 4096 then raise exception 'token_gecersiz'; end if;
  insert into public.cihazlar (token, kullanici) values (p_token, (select auth.uid()))
  on conflict (token) do update set kullanici = excluded.kullanici, guncelleme = now();
  -- bir kullanıcıda en fazla 5 cihaz
  delete from public.cihazlar where token in (
    select token from public.cihazlar where kullanici = (select auth.uid()) order by guncelleme desc offset 5);
end $$;

create or replace function public.cihaz_sil(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.cihazlar where token = p_token and kullanici = (select auth.uid());
$$;

revoke execute on function public.cihaz_kaydet(text), public.cihaz_sil(text) from public, anon;
grant execute on function public.cihaz_kaydet(text), public.cihaz_sil(text) to authenticated;

-- Uygulamanın Firebase istemci ayarı (gizli değil; herkese açık istemci bilgisi). Kasada tutulur.
create or replace function public.firebase_ayar()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'firebase_istemci'), 'null'::jsonb);
$$;
revoke execute on function public.firebase_ayar() from public;
grant execute on function public.firebase_ayar() to anon, authenticated;

-- Edge Function'ın okuyacağı gizli ayarlar (sadece service_role)
create or replace function public.ulak_sirlari()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'hizmet', (select decrypted_secret from vault.decrypted_secrets where name = 'firebase_hizmet'),
    'sir', (select decrypted_secret from vault.decrypted_secrets where name = 'ulak_sir'));
$$;
revoke execute on function public.ulak_sirlari() from public, anon, authenticated;
grant execute on function public.ulak_sirlari() to service_role;

-- Edge Function'ı tetikle
create or replace function public.ulak_tetikle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sir text := (select decrypted_secret from vault.decrypted_secrets where name = 'ulak_sir');
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'ulak_url');
begin
  if v_sir is null or v_url is null then return null; end if;
  -- alıcının kayıtlı cihazı yoksa hiç çağırma
  if not exists (select 1 from public.cihazlar where kullanici = new.alici) then return null; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('tur', tg_argv[0], 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ulak-sir', v_sir),
    timeout_milliseconds := 8000);
  return null;
exception when others then
  return null;   -- bildirim gönderilemese de asıl işlem bozulmasın
end $$;

drop trigger if exists bildirim_ulak on public.bildirimler;
create trigger bildirim_ulak after insert on public.bildirimler
  for each row when (new.tur <> 'hosgeldin') execute function public.ulak_tetikle('bildirim');
drop trigger if exists mesaj_ulak on public.mesajlar;
create trigger mesaj_ulak after insert on public.mesajlar
  for each row execute function public.ulak_tetikle('mesaj');

-- Edge Function için: bildirimin/mesajın gönderilecek hali
create or replace function public.ulak_icerik(p_tur text, p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r record; v jsonb;
begin
  if p_tur = 'bildirim' then
    select b.tur, b.alici, b.kelam_id, p.isim, p.kunye, p.avatar_yol, left(k.icerik, 140) as metin
      into r from public.bildirimler b
      left join public.profiller p on p.id = b.kimden
      left join public.kelamlar k on k.id = b.kelam_id
      where b.id = p_id;
    if not found then return null; end if;
    v := jsonb_build_object('tur', r.tur, 'alici', r.alici, 'kelam', r.kelam_id, 'isim', r.isim, 'kunye', r.kunye,
      'avatar', r.avatar_yol, 'metin', r.metin,
      'okunmamis', (select count(*) from public.bildirimler where alici = r.alici and not okundu));
  elsif p_tur = 'mesaj' then
    select m.alici, m.icerik, p.isim, p.kunye, p.avatar_yol into r
      from public.mesajlar m join public.profiller p on p.id = m.gonderen where m.id = p_id;
    if not found then return null; end if;
    v := jsonb_build_object('tur', 'mesaj', 'alici', r.alici, 'isim', r.isim, 'kunye', r.kunye,
      'avatar', r.avatar_yol, 'metin', left(r.icerik, 300));
  else
    return null;
  end if;
  return v || jsonb_build_object('tokenler',
    coalesce((select jsonb_agg(token) from public.cihazlar where kullanici = (v->>'alici')::uuid), '[]'::jsonb));
end $$;
revoke execute on function public.ulak_icerik(text, bigint) from public, anon, authenticated;
grant execute on function public.ulak_icerik(text, bigint) to service_role;

create or replace function public.cihaz_dusur(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.cihazlar where token = p_token;
$$;
revoke execute on function public.cihaz_dusur(text) from public, anon, authenticated;
grant execute on function public.cihaz_dusur(text) to service_role;
