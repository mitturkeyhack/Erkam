-- ERKAM Yönetim Merkezi: susturma, uzaklaştırma, onay rozeti, duyuru, şikâyet kararı, Suffe düzenleme

alter table public.profiller
  add column if not exists susturma_bitis timestamptz,
  add column if not exists uzak boolean not null default false,
  add column if not exists onayli boolean not null default false;

alter table public.bildirimler add column if not exists metin text check (metin is null or char_length(metin) <= 600);
alter table public.bildirimler drop constraint if exists bildirimler_tur_check;
alter table public.bildirimler add constraint bildirimler_tur_check
  check (tur in ('hosgeldin', 'tasdik', 'cevap', 'etiket', 'yoldas', 'istek', 'kabul', 'duyuru', 'uyari'));

-- profil özetine onay rozeti
create or replace function public.profil_json(p public.profiller) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'kunye', p.kunye, 'isim', p.isim,
                            'avatar_yol', p.avatar_yol, 'rol', p.rol, 'onayli', p.onayli);
$$;

-- uzaklaştırılanın kelamları başkalarına görünmez
create or replace function public.gorebilir(p_yazar uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_yazar = (select auth.uid())
      or public.yonetim_mi()
      or (not exists (select 1 from public.profiller where id = p_yazar and uzak)
          and (not exists (select 1 from public.profiller where id = p_yazar and izole)
               or exists (select 1 from public.yoldasliklar
                           where takip_eden = (select auth.uid()) and takip_edilen = p_yazar and durum = 'onayli')));
$$;

-- ben(): ceza durumunu da döndür
create or replace function public.ben() returns jsonb
language sql stable set search_path = '' as $$
  select public.profil_getir(p.kunye) || jsonb_build_object(
    'okunmamis_bildirim', (select count(*) from public.bildirimler b where b.alici = p.id and not b.okundu),
    'okunmamis_mesaj', (select count(*) from public.mesajlar m where m.alici = p.id and not m.okundu),
    'onayli', p.onayli, 'uzak', p.uzak,
    'susturma_bitis', case when p.susturma_bitis > now() then p.susturma_bitis end,
    'bekleyen_sikayet', case when p.rol = 'yonetim' then (select count(*) from public.sikayetler s where s.durum = 'yeni') end)
    from public.profiller p where p.id = (select auth.uid());
$$;

-- ceza denetimi: susturulan/uzaklaştırılan yazamaz
create or replace function public.ceza_denetle() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kisi uuid; r record;
begin
  v_kisi := case tg_table_name
    when 'kelamlar' then new.yazar
    when 'mesajlar' then new.gonderen
    when 'tasdikler' then new.kisi_id
    when 'yoldasliklar' then new.takip_eden
    when 'sikayetler' then new.bildiren
  end;
  select uzak, susturma_bitis into r from public.profiller where id = v_kisi;
  if r.uzak then raise exception 'uzaklastirildin'; end if;
  if tg_table_name in ('kelamlar', 'mesajlar') and r.susturma_bitis > now() then
    raise exception 'susturuldun';
  end if;
  return new;
end $$;

drop trigger if exists erkam_ceza on public.kelamlar;
create trigger erkam_ceza before insert on public.kelamlar for each row execute function public.ceza_denetle();
drop trigger if exists erkam_ceza on public.mesajlar;
create trigger erkam_ceza before insert on public.mesajlar for each row execute function public.ceza_denetle();
drop trigger if exists erkam_ceza on public.tasdikler;
create trigger erkam_ceza before insert on public.tasdikler for each row execute function public.ceza_denetle();
drop trigger if exists erkam_ceza on public.yoldasliklar;
create trigger erkam_ceza before insert on public.yoldasliklar for each row execute function public.ceza_denetle();
drop trigger if exists erkam_ceza on public.sikayetler;
create trigger erkam_ceza before insert on public.sikayetler for each row execute function public.ceza_denetle();

-- ============ YÖNETİM İŞLEVLERİ (hepsi yönetim_mi ister) ============
create or replace function public.yonetim_denetle() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetim_mi() then raise exception 'yetki_yok'; end if;
end $$;

create or replace function public.yonetim_ozet() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.yonetim_denetle();
  return jsonb_build_object(
    'yoldas', (select count(*) from public.profiller),
    'yoldas_bugun', (select count(*) from public.profiller where olusturma > now() - interval '24 hours'),
    'kelam', (select count(*) from public.kelamlar where ust_id is null),
    'kelam_bugun', (select count(*) from public.kelamlar where ust_id is null and olusturma > now() - interval '24 hours'),
    'cevap', (select count(*) from public.kelamlar where ust_id is not null),
    'mesaj_bugun', (select count(*) from public.mesajlar where olusturma > now() - interval '24 hours'),
    'sikayet', (select count(*) from public.sikayetler where durum = 'yeni'),
    'susturulan', (select count(*) from public.profiller where susturma_bitis > now()),
    'uzak', (select count(*) from public.profiller where uzak),
    'cihaz', (select count(*) from public.cihazlar),
    'gunler', (select jsonb_agg(jsonb_build_object(
        'gun', to_char(g, 'YYYY-MM-DD'),
        'kelam', (select count(*) from public.kelamlar k where k.olusturma >= g and k.olusturma < g + interval '1 day'),
        'yoldas', (select count(*) from public.profiller p where p.olusturma >= g and p.olusturma < g + interval '1 day'))
        order by g)
      from generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') g));
end $$;

create or replace function public.yonetim_sikayetler(p_durum text default 'yeni') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.yonetim_denetle();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'sebep', s.sebep, 'durum', s.durum, 'olusturma', s.olusturma,
      'bildiren', (select public.profil_json(p) from public.profiller p where p.id = s.bildiren),
      'hedef', (select public.profil_json(p) || jsonb_build_object('uzak', p.uzak, 'susturma_bitis', p.susturma_bitis)
                  from public.profiller p where p.id = coalesce(s.hedef_kisi, (select k.yazar from public.kelamlar k where k.id = s.kelam_id))),
      'kelam', (select public.kelam_json(k) || jsonb_build_object('medya', k.medya) from public.kelamlar k where k.id = s.kelam_id))
      order by s.id desc)
    from (select * from public.sikayetler where p_durum = 'hepsi' or durum = p_durum order by id desc limit 100) s), '[]'::jsonb);
end $$;

create or replace function public.yonetim_sikayet_kapat(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.yonetim_denetle();
  update public.sikayetler set durum = 'incelendi' where id = p_id;
end $$;

create or replace function public.yonetim_yoldaslar(p_ara text default null, p_filtre text default 'hepsi') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := nullif(lower(btrim(coalesce(p_ara, ''), ' @')), '');
begin
  perform public.yonetim_denetle();
  return coalesce((select jsonb_agg(x.j order by x.o desc) from (
    select p.olusturma as o, public.profil_json(p) || jsonb_build_object(
        'biyografi', p.biyografi, 'olusturma', p.olusturma, 'uzak', p.uzak, 'izole', p.izole,
        'susturma_bitis', case when p.susturma_bitis > now() then p.susturma_bitis end,
        'eposta', u.email, 'son_giris', u.last_sign_in_at,
        'kelam_sayisi', (select count(*) from public.kelamlar k where k.yazar = p.id),
        'sikayet_sayisi', (select count(*) from public.sikayetler s where s.hedef_kisi = p.id
                              or s.kelam_id in (select id from public.kelamlar where yazar = p.id))) as j
      from public.profiller p left join auth.users u on u.id = p.id
     where (q is null or p.kunye like '%' || q || '%' or lower(p.isim) like '%' || q || '%' or lower(u.email) like '%' || q || '%')
       and (p_filtre = 'hepsi'
            or (p_filtre = 'yeni' and p.olusturma > now() - interval '7 days')
            or (p_filtre = 'susturulan' and p.susturma_bitis > now())
            or (p_filtre = 'uzak' and p.uzak)
            or (p_filtre = 'yonetim' and p.rol = 'yonetim')
            or (p_filtre = 'onayli' and p.onayli))
     order by p.olusturma desc limit 200) x), '[]'::jsonb);
end $$;

-- p_islem: sustur | susturma_kaldir | uzaklastir | geri_al | yonetici_yap | yoldas_yap | onay_ver | onay_kaldir | icerik_sil
create or replace function public.yonetim_yoldas_islem(p_kisi uuid, p_islem text, p_saat integer default null, p_not text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ben uuid := (select auth.uid()); v_metin text; v_n integer;
begin
  perform public.yonetim_denetle();
  if p_kisi = v_ben and p_islem in ('sustur', 'uzaklastir', 'yoldas_yap', 'icerik_sil') then raise exception 'kendin'; end if;
  if not exists (select 1 from public.profiller where id = p_kisi) then raise exception 'yoldas_yok'; end if;
  case p_islem
    when 'sustur' then
      update public.profiller set susturma_bitis = case when p_saat is null then 'infinity'::timestamptz else now() + make_interval(hours => p_saat) end where id = p_kisi;
      v_metin := 'Yönetim seni ' || case when p_saat is null then 'süresiz olarak'
                   when p_saat < 24 then p_saat || ' saatliğine' else (p_saat / 24) || ' günlüğüne' end ||
                 ' susturdu. Bu sürede kelam ve mesaj gönderemezsin.' || coalesce(' Sebep: ' || nullif(btrim(p_not), ''), '');
    when 'susturma_kaldir' then
      update public.profiller set susturma_bitis = null where id = p_kisi;
      v_metin := 'Susturman kaldırıldı. Meclise tekrar hoş geldin.';
    when 'uzaklastir' then
      update public.profiller set uzak = true, rol = 'yoldas' where id = p_kisi;
      delete from public.cihazlar where kullanici = p_kisi;
    when 'geri_al' then
      update public.profiller set uzak = false where id = p_kisi;
      v_metin := 'Meclise geri alındın. Adap ve Usul''e uymaya özen göster.';
    when 'yonetici_yap' then update public.profiller set rol = 'yonetim' where id = p_kisi;
      v_metin := 'Artık meclisin yönetimindesin. Yönetim Merkezi çekmecende.';
    when 'yoldas_yap' then update public.profiller set rol = 'yoldas' where id = p_kisi;
    when 'onay_ver' then update public.profiller set onayli = true where id = p_kisi;
      v_metin := 'Künyen onaylandı; adının yanında onay rozeti görünecek.';
    when 'onay_kaldir' then update public.profiller set onayli = false where id = p_kisi;
    when 'icerik_sil' then
      delete from public.kelamlar where yazar = p_kisi;
      get diagnostics v_n = row_count;
      v_metin := 'Yönetim, Adap ve Usul''e aykırı bulduğu kelamlarını kaldırdı.';
    else raise exception 'islem_gecersiz';
  end case;
  if v_metin is not null then
    insert into public.bildirimler (alici, kimden, tur, metin) values (p_kisi, v_ben, 'uyari', v_metin);
  end if;
  return (select public.profil_json(p) || jsonb_build_object('uzak', p.uzak,
            'susturma_bitis', case when p.susturma_bitis > now() then p.susturma_bitis end)
            from public.profiller p where p.id = p_kisi);
end $$;

create or replace function public.yonetim_duyuru(p_metin text) returns integer
language plpgsql security definer set search_path = '' as $$
declare v text := btrim(coalesce(p_metin, '')); v_n integer;
begin
  perform public.yonetim_denetle();
  if char_length(v) < 3 or char_length(v) > 600 then raise exception 'duyuru_gecersiz'; end if;
  insert into public.bildirimler (alici, kimden, tur, metin)
    select p.id, (select auth.uid()), 'duyuru', v from public.profiller p where not p.uzak;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.yonetim_duyurular() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.yonetim_denetle();
  return coalesce((select jsonb_agg(jsonb_build_object('metin', metin, 'olusturma', o, 'kisi', n) order by o desc)
    from (select metin, max(olusturma) as o, count(*) as n from public.bildirimler
           where tur = 'duyuru' group by metin, date_trunc('minute', olusturma) order by 2 desc limit 20) d), '[]'::jsonb);
end $$;

-- Suffe dersleri
create or replace function public.yonetim_dersler() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.yonetim_denetle();
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kategori', d.kategori, 'baslik', d.baslik, 'ozet', d.ozet,
      'sure_dk', d.sure_dk, 'ikon', d.ikon, 'icerik', d.icerik, 'sira', d.sira, 'yayinda', d.yayinda) order by d.sira, d.id)
    from public.suffe_dersler d), '[]'::jsonb);
end $$;

create or replace function public.yonetim_ders_kaydet(p_id integer, p_kategori text, p_baslik text, p_ozet text,
  p_icerik text, p_sure integer default 10, p_yayinda boolean default true) returns integer
language plpgsql security definer set search_path = '' as $$
declare v integer;
begin
  perform public.yonetim_denetle();
  if char_length(btrim(coalesce(p_baslik, ''))) < 2 then raise exception 'baslik_gecersiz'; end if;
  if p_id is null then
    insert into public.suffe_dersler (kategori, baslik, ozet, icerik, sure_dk, yayinda, sira)
      values (p_kategori, btrim(p_baslik), btrim(coalesce(p_ozet, '')), coalesce(p_icerik, ''), greatest(1, coalesce(p_sure, 10)), p_yayinda,
              coalesce((select max(sira) + 1 from public.suffe_dersler), 0))
      returning id into v;
  else
    update public.suffe_dersler set kategori = p_kategori, baslik = btrim(p_baslik), ozet = btrim(coalesce(p_ozet, '')),
      icerik = coalesce(p_icerik, ''), sure_dk = greatest(1, coalesce(p_sure, 10)), yayinda = p_yayinda where id = p_id;
    v := p_id;
  end if;
  return v;
end $$;

create or replace function public.yonetim_ders_sil(p_id integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.yonetim_denetle();
  delete from public.suffe_dersler where id = p_id;
end $$;

do $$ declare f text; begin
  foreach f in array array['yonetim_ozet()', 'yonetim_sikayetler(text)', 'yonetim_sikayet_kapat(bigint)',
    'yonetim_yoldaslar(text, text)', 'yonetim_yoldas_islem(uuid, text, integer, text)', 'yonetim_duyuru(text)',
    'yonetim_duyurular()', 'yonetim_dersler()', 'yonetim_ders_kaydet(integer, text, text, text, text, integer, boolean)',
    'yonetim_ders_sil(integer)', 'yonetim_denetle()'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

-- anlık bildirim içeriğine duyuru/uyarı metni
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
revoke execute on function public.ulak_icerik(text, bigint) from public, anon, authenticated;
grant execute on function public.ulak_icerik(text, bigint) to service_role;

-- bildirim listesine metin
create or replace function public.bildirim_listesi(p_limit integer default 40) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'tur', b.tur, 'okundu', b.okundu, 'olusturma', b.olusturma, 'kelam_id', b.kelam_id, 'metin', b.metin,
      'kimden', (select public.profil_json(p) from public.profiller p where p.id = b.kimden))
      order by b.id desc), '[]'::jsonb)
    from (select * from public.bildirimler where alici = (select auth.uid())
           order by id desc limit least(greatest(coalesce(p_limit, 40), 1), 100)) b;
$$;
