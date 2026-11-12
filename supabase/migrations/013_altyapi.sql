-- 013: Altyapı — meclis odalarında Realtime, artımlı mesaj, eksik dizinler, kota özeti, yetki sıkılaştırma

-- ================= Eksik dizinler (yabancı anahtarlar) =================
create index if not exists basvurular_kisi_idx on public.basvurular (kisi);
create index if not exists emanet_kayitlari_kisi_idx on public.emanet_kayitlari (kisi);
create index if not exists istisare_oylari_kisi_idx on public.istisare_oylari (kisi);
create index if not exists istisareler_sahip_idx on public.istisareler (sahip);
create index if not exists kelam_gorenler_kisi_idx on public.kelam_gorenler (kisi);
create index if not exists oda_mesajlari_gonderen_idx on public.oda_mesajlari (gonderen);
create index if not exists odalar_kurucu_idx on public.odalar (kurucu);
create index if not exists oturum_cihazlari_kisi_idx on public.oturum_cihazlari (kisi);
create index if not exists profiller_seckin_idx on public.profiller (seckin);

-- ================= Oda mesajı JSON (tek yerde) =================
create or replace function public.oda_mesaj_json(m public.oda_mesajlari)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'icerik', m.icerik, 'tur', m.tur, 'olusturma', m.olusturma,
    'benden', m.gonderen = (select auth.uid()),
    'istisare', (select public.istisare_json(i.id) from public.istisareler i where i.oda_mesaj = m.id),
    'kisi', (select public.profil_json(p) from public.profiller p where p.id = m.gonderen));
$$;

-- yalnızca verilen numaradan sonraki mesajlar (Realtime haberi gelince ya da yedek yoklamada)
create or replace function public.oda_yeni(p_oda uuid, p_sonra bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v jsonb; v_son bigint;
begin
  if not public.oda_uyesi_mi(p_oda) then raise exception 'oda_yok'; end if;
  select coalesce(jsonb_agg(public.oda_mesaj_json(m) order by m.id), '[]'::jsonb), max(m.id) into v, v_son
    from (select * from public.oda_mesajlari where oda = p_oda and id > coalesce(p_sonra, 0) order by id limit 100) m;
  if v_son is not null then
    update public.oda_uyeleri set son_okunan = v_son where oda = p_oda and kisi = v_ben and son_okunan < v_son;
  end if;
  return v;
end $$;

-- ================= Realtime: özel oda kanalları =================
-- Kanal adı: oda:<uuid>. Yalnızca odanın üyeleri dinleyebilir.
create or replace function public.oda_kanal_izni(p_konu text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if p_konu is null or p_konu !~ '^oda:[0-9a-f-]{36}$' then return false; end if;
  return public.oda_uyesi_mi(substring(p_konu from 5)::uuid);
end $$;

drop policy if exists "oda uyeleri dinler" on realtime.messages;
create policy "oda uyeleri dinler" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension = 'broadcast' and public.oda_kanal_izni((select realtime.topic())));

-- yeni mesaj: odaya yalnızca "yeni mesaj var" haberi gider (içerik değil); istemci kendisi çeker
create or replace function public.oda_yayin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('id', new.id, 'tur', new.tur), 'mesaj', 'oda:' || new.oda::text, true);
  return null;
exception when others then
  return null;
end $$;
drop trigger if exists oda_yayin on public.oda_mesajlari;
create trigger oda_yayin after insert on public.oda_mesajlari for each row execute function public.oda_yayin();

-- oda içindeki istişareye oy: sayıları tazelemek için haber
create or replace function public.oda_oy_yayin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_oda uuid;
begin
  select m.oda into v_oda from public.istisareler i join public.oda_mesajlari m on m.id = i.oda_mesaj where i.id = new.istisare;
  if v_oda is not null then
    perform realtime.send(jsonb_build_object('istisare', new.istisare), 'oy', 'oda:' || v_oda::text, true);
  end if;
  return null;
exception when others then
  return null;
end $$;
drop trigger if exists oda_oy_yayin on public.istisare_oylari;
create trigger oda_oy_yayin after insert on public.istisare_oylari for each row execute function public.oda_oy_yayin();

-- ================= Kota özeti (yönetim) =================
create or replace function public.yonetim_kota()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetim_mi() then raise exception 'yetki_yok'; end if;
  return jsonb_build_object(
    'veritabani', pg_database_size(current_database()),
    'veritabani_sinir', 500 * 1024 * 1024,
    'depolama', coalesce((select sum((metadata ->> 'size')::bigint) from storage.objects), 0),
    'depolama_sinir', 1024 * 1024 * 1024,
    'dosya', (select count(*) from storage.objects),
    'aylik_aktif', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'aylik_aktif_sinir', 50000,
    'gunluk_aktif', (select count(distinct user_id) from auth.sessions where updated_at > now() - interval '1 day'),
    'kelam', (select count(*) from public.kelamlar),
    'oda_mesaj', (select count(*) from public.oda_mesajlari),
    'olcum', now());
end $$;

-- ================= Yetki sıkılaştırma =================
-- tetikleyici ve iç yardımcı işlevler API'den çağrılamasın
revoke execute on function public.ceza_denetle() from public, anon, authenticated;
revoke execute on function public.kunye_korumasi() from public, anon, authenticated;
revoke execute on function public.ulak_tetikle() from public, anon, authenticated;
revoke execute on function public.oda_ulak_tetikle() from public, anon, authenticated;
revoke execute on function public.oda_yayin() from public, anon, authenticated;
revoke execute on function public.oda_oy_yayin() from public, anon, authenticated;
revoke execute on function public.oda_yeni(uuid, bigint) from public, anon;
grant execute on function public.oda_yeni(uuid, bigint) to authenticated;
revoke execute on function public.yonetim_kota() from public, anon;
grant execute on function public.yonetim_kota() to authenticated;
