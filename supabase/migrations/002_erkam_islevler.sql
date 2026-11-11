-- ERKAM — uygulamanın çağırdığı işlevler (RPC) ve Suffe başlangıç dersleri

create function public.kunye_musait(p_kunye text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(coalesce(p_kunye, '')) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiller where kunye = lower(p_kunye));
$$;

create function public.profil_json(p public.profiller) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'kunye', p.kunye, 'isim', p.isim,
                            'avatar_yol', p.avatar_yol, 'rol', p.rol);
$$;

create function public.kelam_json(k public.kelamlar) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', k.id, 'icerik', k.icerik, 'kategori', k.kategori, 'muhurler', k.muhurler,
    'gorsel_yol', k.gorsel_yol, 'ust_id', k.ust_id,
    'tasdik_sayisi', k.tasdik_sayisi, 'cevap_sayisi', k.cevap_sayisi, 'olusturma', k.olusturma,
    'yazar', (select public.profil_json(p) from public.profiller p where p.id = k.yazar),
    'tasdikledim', exists (select 1 from public.tasdikler t
                            where t.kelam_id = k.id and t.kisi_id = (select auth.uid())),
    'heybemde', exists (select 1 from public.heybe h
                         where h.kelam_id = k.id and h.kisi_id = (select auth.uid())));
$$;

-- Kelam listeleri: sura | yazar | cevap | muhur | ara | heybe
create function public.kelam_listesi(
  p_kaynak text, p_yazar uuid default null, p_metin text default null,
  p_once timestamptz default null, p_limit integer default 20
) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v jsonb;
  v_lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_like text;
begin
  if p_kaynak = 'sura' then
    select coalesce(jsonb_agg(j order by o desc), '[]'::jsonb) into v from (
      select public.kelam_json(k) as j, k.olusturma as o from public.kelamlar k
       where k.ust_id is null and (p_once is null or k.olusturma < p_once)
       order by k.olusturma desc limit v_lim) s;
  elsif p_kaynak = 'yazar' then
    select coalesce(jsonb_agg(j order by o desc), '[]'::jsonb) into v from (
      select public.kelam_json(k) as j, k.olusturma as o from public.kelamlar k
       where k.yazar = p_yazar and k.ust_id is null and (p_once is null or k.olusturma < p_once)
       order by k.olusturma desc limit v_lim) s;
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
       where k.icerik ilike v_like and (p_once is null or k.olusturma < p_once)
       order by k.olusturma desc limit v_lim) s;
  elsif p_kaynak = 'heybe' then
    select coalesce(jsonb_agg(j order by o desc), '[]'::jsonb) into v from (
      select public.kelam_json(k) as j, h.olusturma as o
        from public.heybe h join public.kelamlar k on k.id = h.kelam_id
       where h.kisi_id = (select auth.uid()) and (p_once is null or h.olusturma < p_once)
       order by h.olusturma desc limit v_lim) s;
  else
    v := '[]'::jsonb;
  end if;
  return v;
end $$;

create function public.kelam_detay(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'kelam', public.kelam_json(k),
    'cevaplar', coalesce((select jsonb_agg(public.kelam_json(c) order by c.olusturma)
                            from public.kelamlar c where c.ust_id = k.id), '[]'::jsonb))
    from public.kelamlar k where k.id = p_id;
$$;

create function public.kelam_nakset(
  p_icerik text, p_kategori text default 'ilim', p_muhurler text[] default '{}',
  p_gorsel text default null, p_ust uuid default null
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v public.kelamlar;
  v_ben uuid := (select auth.uid());
  v_gorsel text := p_gorsel;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if v_gorsel is not null and v_gorsel not like v_ben::text || '/%' then v_gorsel := null; end if;
  insert into public.kelamlar (yazar, ust_id, icerik, kategori, muhurler, gorsel_yol)
    values (v_ben, p_ust, p_icerik, coalesce(p_kategori, 'ilim'), coalesce(p_muhurler, '{}'), v_gorsel)
    returning * into v;
  return public.kelam_json(v);
end $$;

create function public.kelam_sil(p_id uuid) returns boolean
language plpgsql set search_path = '' as $$
begin
  delete from public.kelamlar where id = p_id;
  return found;
end $$;

create function public.tasdik_degistir(p_kelam uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v_var boolean;
  v_sayi integer;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  delete from public.tasdikler where kelam_id = p_kelam and kisi_id = v_ben;
  if found then
    v_var := false;
  else
    insert into public.tasdikler (kelam_id, kisi_id) values (p_kelam, v_ben);
    v_var := true;
  end if;
  select tasdik_sayisi into v_sayi from public.kelamlar where id = p_kelam;
  return jsonb_build_object('tasdikledim', v_var, 'tasdik_sayisi', coalesce(v_sayi, 0));
end $$;

create function public.heybe_degistir(p_kelam uuid) returns boolean
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  delete from public.heybe where kelam_id = p_kelam and kisi_id = v_ben;
  if found then return false; end if;
  insert into public.heybe (kisi_id, kelam_id) values (v_ben, p_kelam);
  return true;
end $$;

-- Profil (sayılar gizli bağ tablosundan okunduğu için yetkili çalışır, yalnız özet döner)
create function public.profil_getir(p_kunye text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.profiller;
  v_ben uuid := (select auth.uid());
  v_iliski text;
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
  return jsonb_build_object(
    'id', p.id, 'kunye', p.kunye, 'isim', p.isim, 'biyografi', p.biyografi,
    'avatar_yol', p.avatar_yol, 'kapak_yol', p.kapak_yol, 'izole', p.izole, 'rol', p.rol,
    'olusturma', p.olusturma, 'iliski', v_iliski, 'gorebilir', public.gorebilir(p.id),
    'takip_edilen_sayisi', (select count(*) from public.yoldasliklar where takip_eden = p.id and durum = 'onayli'),
    'yoldas_sayisi', (select count(*) from public.yoldasliklar where takip_edilen = p.id and durum = 'onayli'),
    'kelam_sayisi', (select count(*) from public.kelamlar where yazar = p.id and ust_id is null),
    'bekleyen_istek', case when p.id = v_ben
        then (select count(*) from public.yoldasliklar where takip_edilen = p.id and durum = 'bekliyor')
        else 0 end);
end $$;

create function public.ben() returns jsonb
language sql stable set search_path = '' as $$
  select public.profil_getir(p.kunye) || jsonb_build_object(
    'okunmamis_bildirim', (select count(*) from public.bildirimler b where b.alici = p.id and not b.okundu),
    'okunmamis_mesaj', (select count(*) from public.mesajlar m where m.alici = p.id and not m.okundu))
    from public.profiller p where p.id = (select auth.uid());
$$;

create function public.profil_guncelle(p_isim text, p_kunye text, p_biyografi text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v_isim text := btrim(coalesce(p_isim, ''));
  v_kunye text := lower(btrim(coalesce(p_kunye, ''), ' @'));
  v_bio text := btrim(coalesce(p_biyografi, ''));
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if char_length(v_isim) < 2 or char_length(v_isim) > 40 then raise exception 'isim_gecersiz'; end if;
  if v_kunye !~ '^[a-z0-9_]{3,20}$' then raise exception 'kunye_gecersiz'; end if;
  if char_length(v_bio) > 160 then raise exception 'biyografi_uzun'; end if;
  if exists (select 1 from public.profiller where kunye = v_kunye and id <> v_ben) then
    raise exception 'kunye_dolu';
  end if;
  update public.profiller set isim = v_isim, kunye = v_kunye, biyografi = v_bio where id = v_ben;
  return public.ben();
end $$;

create function public.profil_gorsel(p_tur text, p_yol text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if p_yol is not null and p_yol not like v_ben::text || '/%' then raise exception 'yol_gecersiz'; end if;
  if p_tur = 'avatar' then
    update public.profiller set avatar_yol = p_yol where id = v_ben;
  elsif p_tur = 'kapak' then
    update public.profiller set kapak_yol = p_yol where id = v_ben;
  else
    raise exception 'tur_gecersiz';
  end if;
  return public.ben();
end $$;

create function public.izole_ayarla(p_acik boolean) returns boolean
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  update public.profiller set izole = coalesce(p_acik, false) where id = v_ben;
  if not coalesce(p_acik, false) then
    update public.yoldasliklar set durum = 'onayli' where takip_edilen = v_ben and durum = 'bekliyor';
  end if;
  return coalesce(p_acik, false);
end $$;

-- Yoldaş edin / bırak / isteği geri çek. Dönen değer: yok | onayli | bekliyor
create function public.yoldas_degistir(p_kisi uuid) returns text
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v_durum text;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if p_kisi = v_ben then raise exception 'kendin'; end if;
  delete from public.yoldasliklar where takip_eden = v_ben and takip_edilen = p_kisi;
  if found then return 'yok'; end if;
  insert into public.yoldasliklar (takip_eden, takip_edilen) values (v_ben, p_kisi)
    returning durum into v_durum;
  return v_durum;
end $$;

create function public.istek_cevapla(p_kisi uuid, p_kabul boolean) returns boolean
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if coalesce(p_kabul, false) then
    update public.yoldasliklar set durum = 'onayli'
     where takip_eden = p_kisi and takip_edilen = v_ben and durum = 'bekliyor';
  else
    delete from public.yoldasliklar
     where takip_eden = p_kisi and takip_edilen = v_ben and durum = 'bekliyor';
  end if;
  return found;
end $$;

create function public.bildirim_listesi(p_limit integer default 40) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'tur', b.tur, 'okundu', b.okundu, 'olusturma', b.olusturma, 'kelam_id', b.kelam_id,
      'kimden', (select public.profil_json(p) from public.profiller p where p.id = b.kimden))
      order by b.id desc), '[]'::jsonb)
    from (select * from public.bildirimler where alici = (select auth.uid())
           order by id desc limit least(greatest(coalesce(p_limit, 40), 1), 100)) b;
$$;

create function public.bildirimleri_okundu() returns integer
language plpgsql set search_path = '' as $$
declare
  v integer;
begin
  update public.bildirimler set okundu = true where alici = (select auth.uid()) and not okundu;
  get diagnostics v = row_count;
  return v;
end $$;

create function public.sohbet_listesi() returns jsonb
language sql stable set search_path = '' as $$
  with m as (
    select id, icerik, olusturma, okundu, gonderen, alici,
           case when gonderen = (select auth.uid()) then alici else gonderen end as kisi
      from public.mesajlar
     where gonderen = (select auth.uid()) or alici = (select auth.uid())),
  son as (select distinct on (kisi) kisi, id, icerik, olusturma, gonderen from m order by kisi, id desc),
  say as (select kisi, count(*) filter (where alici = (select auth.uid()) and not okundu) as n
            from m group by kisi)
  select coalesce(jsonb_agg(jsonb_build_object(
      'kisi', (select public.profil_json(p) from public.profiller p where p.id = son.kisi),
      'son', son.icerik, 'zaman', son.olusturma,
      'benden', son.gonderen = (select auth.uid()), 'okunmamis', say.n)
      order by son.id desc), '[]'::jsonb)
    from son join say using (kisi);
$$;

create function public.sohbet_getir(p_kisi uuid, p_once bigint default null, p_limit integer default 50)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v jsonb;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  update public.mesajlar set okundu = true where alici = v_ben and gonderen = p_kisi and not okundu;
  select jsonb_build_object(
    'kisi', (select public.profil_json(p) from public.profiller p where p.id = p_kisi),
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'icerik', x.icerik, 'olusturma', x.olusturma,
                                          'benden', x.gonderen = v_ben, 'okundu', x.okundu) order by x.id)
        from (select * from public.mesajlar
               where ((gonderen = v_ben and alici = p_kisi) or (gonderen = p_kisi and alici = v_ben))
                 and (p_once is null or id < p_once)
               order by id desc limit least(greatest(coalesce(p_limit, 50), 1), 100)) x), '[]'::jsonb))
    into v;
  return v;
end $$;

create function public.mesaj_gonder(p_alici uuid, p_icerik text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v public.mesajlar;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if p_alici = v_ben then raise exception 'kendin'; end if;
  if not exists (select 1 from public.profiller where id = p_alici) then raise exception 'yoldas_yok'; end if;
  insert into public.mesajlar (gonderen, alici, icerik) values (v_ben, p_alici, p_icerik)
    returning * into v;
  return jsonb_build_object('id', v.id, 'icerik', v.icerik, 'olusturma', v.olusturma,
                            'benden', true, 'okundu', false);
end $$;

create function public.suffe_listesi() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'kategori', d.kategori, 'baslik', d.baslik, 'ozet', d.ozet,
      'sure_dk', d.sure_dk, 'ikon', d.ikon,
      'yuzde', coalesce((select i.yuzde from public.suffe_ilerleme i
                          where i.ders_id = d.id and i.kisi_id = (select auth.uid())), 0))
      order by d.sira, d.id), '[]'::jsonb)
    from public.suffe_dersler d;
$$;

create function public.ders_getir(p_id integer) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
      'id', d.id, 'kategori', d.kategori, 'baslik', d.baslik, 'ozet', d.ozet,
      'sure_dk', d.sure_dk, 'ikon', d.ikon, 'icerik', d.icerik,
      'yuzde', coalesce((select i.yuzde from public.suffe_ilerleme i
                          where i.ders_id = d.id and i.kisi_id = (select auth.uid())), 0))
    from public.suffe_dersler d where d.id = p_id;
$$;

create function public.ders_ilerlet(p_id integer, p_yuzde integer) returns integer
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v integer;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  insert into public.suffe_ilerleme as i (kisi_id, ders_id, yuzde)
    values (v_ben, p_id, least(greatest(coalesce(p_yuzde, 0), 0), 100))
    on conflict (kisi_id, ders_id) do update
      set yuzde = greatest(i.yuzde, excluded.yuzde), guncelleme = now()
    returning i.yuzde into v;
  return v;
end $$;

create function public.muhur_gundemi() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('muhur', m, 'sayi', n) order by n desc, m), '[]'::jsonb)
    from (select m, count(*) as n
            from (select muhurler from public.kelamlar where ust_id is null
                   order by olusturma desc limit 500) k, unnest(k.muhurler) m
           group by m order by count(*) desc, m limit 10) s;
$$;

create function public.ara(p_q text) returns jsonb
language plpgsql stable set search_path = '' as $$
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
         where p.kunye ilike v_like or p.isim ilike v_like
         order by (p.kunye = lower(q)) desc, p.kunye limit 12) s), '[]'::jsonb),
    'muhurler', coalesce((select jsonb_agg(jsonb_build_object('muhur', m, 'sayi', n)) from (
        select m, count(*) as n from public.kelamlar k, unnest(k.muhurler) m
         where m ilike v_like group by m order by count(*) desc, m limit 8) s), '[]'::jsonb),
    'kelamlar', public.kelam_listesi('ara', null, q, null, 20));
end $$;

create function public.sikayet_et(p_kelam uuid, p_sebep text) returns boolean
language plpgsql set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v_yazar uuid;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  select yazar into v_yazar from public.kelamlar where id = p_kelam;
  if not found then raise exception 'kelam_yok'; end if;
  insert into public.sikayetler (bildiren, kelam_id, hedef_kisi, sebep)
    values (v_ben, p_kelam, v_yazar, btrim(coalesce(p_sebep, 'Uygunsuz içerik')));
  return true;
end $$;

create function public.hesabimi_sil() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  delete from auth.users where id = v_ben;
  return true;
end $$;

-- İşlevleri yalnız giriş yapmış üyeler çağırabilir (künye sorgusu hariç)
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.kunye_musait(text) to anon;

-- ============ SUFFE: başlangıç dersleri ============

insert into public.suffe_dersler (kategori, baslik, ozet, sure_dk, ikon, sira, icerik) values
('siber', 'Sızma Testi Temelleri',
 'Ağ üzerinde güvenlik açıklarını tespit etme usulleri ve savunma mekanizmaları.', 15, 'shield-account', 1,
$d$## Sızma testi nedir?
Sızma testi, bir sistemin zayıf noktalarını saldırgandan önce bulup kapatmak için yapılan izinli güvenlik denetimidir. Amaç zarar vermek değil, zararı önlemektir.

## Altın kural: izin
Sahibinden yazılı izin alınmamış hiçbir sisteme test yapılmaz. İzinsiz deneme, niyet ne olursa olsun hem suçtur hem de ERKAM düsturuna aykırıdır.

## Bir testin aşamaları
Kapsam belirlenir: neye bakılacak, neye dokunulmayacak. Ardından sistem tanınır, zayıf noktalar aranır, bulunanlar kanıtıyla doğrulanır ve hepsi bir raporda toplanır.

## Rapor, işin kendisidir
İyi bir rapor açığı, riskini ve nasıl kapatılacağını sade bir dille anlatır. Açığı bulmak yolun yarısıdır; kapatılmasını sağlamak diğer yarısıdır.

## Savunma tarafı
Güncel yazılım, güçlü parola ve iki adımlı doğrulama, en az yetki ilkesi ve düzenli yedek; saldırıların büyük kısmını daha başlamadan durdurur.$d$),
('siber', 'Termux ve Python',
 'Mobil ortamda betik yazımı, otomasyon araçları ve sistem yönetimi.', 10, 'console', 2,
$d$## Termux nedir?
Termux, Android telefonda çalışan bir Linux komut satırı ortamıdır. Bilgisayarın olmasa da paket kurabilir, betik yazabilir ve küçük otomasyonlar kurabilirsin.

## İlk adımlar
Kurulumdan sonra paket listesini güncelle, ardından Python'u kur. Dosyalarına erişmek için depolama iznini bir kez vermen yeterlidir.

## Python ile otomasyon
Tekrar eden işleri betiğe dökmek en iyi alıştırmadır: dosya adlarını düzenlemek, bir klasörü yedeklemek, bir metinden bilgi ayıklamak gibi.

## Düzenli çalış
Betiklerini tek bir klasörde tut, her birinin başına ne işe yaradığını yaz. Bugün yazdığın küçük araç, yarın bir yoldaşın işini görür.

## Sınırını bil
Telefonun gücü sınırlıdır ve her araç her yerde kullanılmaz. Öğrendiklerini yalnızca kendi cihazında ve izinli ortamlarda dene.$d$),
('adap', 'Meclis Adabı',
 'Yoldaşlar arası iletişimde dikkat edilmesi gereken hususlar ve ERKAM düsturu.', 5, 'scale-balance', 3,
$d$## Meclisin ruhu
ERKAM bir yoldaşlık evidir. Burada yazılan her kelam, yazanın kimliğini taşır.

## Sırrın Muhafazası
Mecliste paylaşılan özel bilgiler ve yoldaş kimlikleri dışarıya aktarılmaz. Mahremiyet en büyük onurumuzdur.

## İlmin İnfakı
Edinilen bilgi saklanmaz. Öğrendiğini bir diğer yoldaşa aktarmak, bu meclisin asli vazifesidir.

## Savunma Önceliği
Öğrenilen yöntemler yalnızca sistemleri korumak ve açık kapatmak için kullanılır. Yıkıcı olmak yasaktır.

## Yoldaşlık Hukuku
Şûra meclisinde hiçbir yoldaşın bilgisi hor görülmez. Üslup, bir ERKAM mensubunun kimliğidir.$d$),
('siber', 'Ağ Güvenliği Protokolleri',
 'Veri paketlerinin şifrelenmesi ve siber saldırılara karşı korunması.', 20, 'lan', 4,
$d$## Veri yolda nasıl korunur?
İnternette gönderdiğin her şey paketlere bölünür ve pek çok cihazdan geçer. Şifreleme olmazsa yol üstündeki herkes içeriği okuyabilir.

## HTTPS ve TLS
Adres çubuğundaki kilit, bağlantının TLS ile şifrelendiğini gösterir. TLS hem içeriği gizler hem de karşıdaki sitenin gerçekten o site olduğunu doğrular.

## Ortak Wi-Fi
Kafe ve otel ağlarında trafiğin başkalarıyla aynı ağdan geçer. Hassas işlemleri mobil veriyle ya da güvendiğin bir VPN üzerinden yap.

## Güvenlik duvarı
Güvenlik duvarı, hangi bağlantının girip çıkacağına karar veren kapı görevlisidir. Kullanılmayan her kapı kapalı tutulur.

## Alışkanlık, araçtan önce gelir
Güncellemeleri erteleme, tanımadığın ağlara otomatik bağlanma, her hesapta ayrı parola kullan. Protokoller ancak doğru alışkanlıkla işe yarar.$d$),
('yazilim', 'React Native İle Mobil Geliştirme',
 'Uygulama mimarisi kurma ve komponent mantığı.', 25, 'cellphone', 5,
$d$## React Native nedir?
React Native, tek bir kod tabanıyla hem Android hem iOS uygulaması yazmayı sağlar. Arayüzü küçük parçalara, yani komponentlere bölerek kurarsın.

## Komponent mantığı
Her komponent tek bir işi yapar: bir düğme, bir kart, bir liste satırı. Küçük parçalar birleşerek ekranı, ekranlar birleşerek uygulamayı oluşturur.

## Durum ve veri
Ekranda değişen her şey bir durumdur. Durum değişince arayüz kendini yeniler; sen yalnızca verinin ne olduğunu söylersin.

## Mimariyi baştan kur
Ekranları, ortak komponentleri ve veri katmanını ayrı klasörlerde tut. Düzenli bir iskelet, uygulama büyüdüğünde seni kurtarır.

## Önce çalışsın, sonra güzelleşsin
Küçük bir ekranla başla, çalıştır, sonra geliştir. Her adımda telefonda dene; hatayı erken görmek en ucuz çözümdür.$d$);
