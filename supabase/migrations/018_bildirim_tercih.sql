-- Bildirim ayarları: kullanıcı hangi türlerin telefonuna geleceğini seçer
alter table public.profiller add column if not exists bildirim_tercih jsonb not null default '{}'::jsonb;

create or replace function public.bildirim_kategori(p_tur text)
 returns text language sql immutable set search_path to ''
as $$
  select case
    when p_tur = 'mesaj' then 'mesaj'
    when p_tur in ('cevap', 'etiket', 'iktibas', 'nakil') then 'cevap'
    when p_tur = 'tasdik' then 'tasdik'
    when p_tur in ('yoldas', 'istek', 'kabul') then 'yoldas'
    when p_tur = 'oda' then 'oda'
    when p_tur = 'duyuru' then 'duyuru'
    else null end;
$$;

-- kapatılmadıkça açık sayılır; yönetim uyarıları her zaman gider
create or replace function public.bildirim_izinli(p_kisi uuid, p_tur text)
 returns boolean language sql stable set search_path to ''
as $$
  select coalesce((select (p.bildirim_tercih ->> public.bildirim_kategori(p_tur))::boolean
                     from public.profiller p where p.id = p_kisi), true)
      or public.bildirim_kategori(p_tur) is null;
$$;

create or replace function public.bildirim_tercihlerim()
 returns jsonb language sql stable security definer set search_path to ''
as $$ select coalesce((select bildirim_tercih from public.profiller where id = (select auth.uid())), '{}'::jsonb); $$;

create or replace function public.bildirim_tercih_kaydet(p_tur text, p_acik boolean)
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare t jsonb;
begin
  if (select auth.uid()) is null then raise exception 'oturum_yok'; end if;
  if p_tur not in ('mesaj', 'cevap', 'tasdik', 'yoldas', 'oda', 'duyuru') then raise exception 'gecersiz'; end if;
  update public.profiller set bildirim_tercih = bildirim_tercih || jsonb_build_object(p_tur, coalesce(p_acik, true))
   where id = (select auth.uid()) returning bildirim_tercih into t;
  return t;
end $$;

revoke all on function public.bildirim_tercihlerim() from public, anon;
revoke all on function public.bildirim_tercih_kaydet(text, boolean) from public, anon;
grant execute on function public.bildirim_tercihlerim() to authenticated;
grant execute on function public.bildirim_tercih_kaydet(text, boolean) to authenticated;
revoke all on function public.bildirim_izinli(uuid, text) from public, anon, authenticated;

create or replace function public.ulak_icerik(p_tur text, p_id bigint)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
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
                             where u.oda = r.oda and u.kisi is distinct from r.gonderen
                               and public.bildirim_izinli(u.kisi, 'oda')), '[]'::jsonb));
  else
    return null;
  end if;
  insert into public.ulak_gidenler (tur, id) values (p_tur, p_id) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return null; end if;
  delete from public.ulak_gidenler where zaman < now() - interval '1 day';
  if not public.bildirim_izinli((v->>'alici')::uuid, v->>'tur') then
    return v || jsonb_build_object('tokenler', '[]'::jsonb);
  end if;
  return v || jsonb_build_object('tokenler',
    coalesce((select jsonb_agg(token) from public.cihazlar where kullanici = (v->>'alici')::uuid), '[]'::jsonb));
end $function$;
