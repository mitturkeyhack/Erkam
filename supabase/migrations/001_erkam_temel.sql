-- ERKAM — temel şema: tablolar, tetikleyiciler, güvenlik kuralları (RLS)

-- ============ TABLOLAR ============

create table public.profiller (
  id uuid primary key references auth.users(id) on delete cascade,
  kunye text not null unique check (kunye ~ '^[a-z0-9_]{3,20}$'),
  isim text not null check (char_length(isim) between 2 and 40),
  biyografi text not null default 'ERKAM ağının kıymetli bir yoldaşı.' check (char_length(biyografi) <= 160),
  avatar_yol text,
  kapak_yol text,
  izole boolean not null default false,
  rol text not null default 'yoldas' check (rol in ('yoldas', 'yonetim')),
  olusturma timestamptz not null default now()
);

create table public.kelamlar (
  id uuid primary key default gen_random_uuid(),
  yazar uuid not null references public.profiller(id) on delete cascade,
  ust_id uuid references public.kelamlar(id) on delete cascade,
  icerik text not null check (char_length(btrim(icerik)) between 1 and 500),
  kategori text not null default 'ilim' check (kategori in ('ilim', 'tecrube', 'infak', 'adap')),
  muhurler text[] not null default '{}',
  gorsel_yol text,
  tasdik_sayisi integer not null default 0,
  cevap_sayisi integer not null default 0,
  olusturma timestamptz not null default now()
);
create index kelamlar_akis_idx on public.kelamlar (olusturma desc) where ust_id is null;
create index kelamlar_yazar_idx on public.kelamlar (yazar, olusturma desc);
create index kelamlar_ust_idx on public.kelamlar (ust_id, olusturma) where ust_id is not null;
create index kelamlar_muhur_idx on public.kelamlar using gin (muhurler);

create table public.tasdikler (
  kelam_id uuid not null references public.kelamlar(id) on delete cascade,
  kisi_id uuid not null references public.profiller(id) on delete cascade,
  olusturma timestamptz not null default now(),
  primary key (kelam_id, kisi_id)
);
create index tasdikler_kisi_idx on public.tasdikler (kisi_id);

create table public.heybe (
  kisi_id uuid not null references public.profiller(id) on delete cascade,
  kelam_id uuid not null references public.kelamlar(id) on delete cascade,
  olusturma timestamptz not null default now(),
  primary key (kisi_id, kelam_id)
);
create index heybe_kelam_idx on public.heybe (kelam_id);

create table public.yoldasliklar (
  takip_eden uuid not null references public.profiller(id) on delete cascade,
  takip_edilen uuid not null references public.profiller(id) on delete cascade,
  durum text not null default 'onayli' check (durum in ('onayli', 'bekliyor')),
  olusturma timestamptz not null default now(),
  primary key (takip_eden, takip_edilen),
  check (takip_eden <> takip_edilen)
);
create index yoldasliklar_edilen_idx on public.yoldasliklar (takip_edilen, durum);

create table public.mesajlar (
  id bigint generated always as identity primary key,
  gonderen uuid not null references public.profiller(id) on delete cascade,
  alici uuid not null references public.profiller(id) on delete cascade,
  icerik text not null check (char_length(btrim(icerik)) between 1 and 2000),
  okundu boolean not null default false,
  olusturma timestamptz not null default now(),
  check (gonderen <> alici)
);
create index mesajlar_gonderen_idx on public.mesajlar (gonderen, id desc);
create index mesajlar_alici_idx on public.mesajlar (alici, id desc);

create table public.bildirimler (
  id bigint generated always as identity primary key,
  alici uuid not null references public.profiller(id) on delete cascade,
  kimden uuid references public.profiller(id) on delete cascade,
  tur text not null check (tur in ('hosgeldin', 'tasdik', 'cevap', 'etiket', 'yoldas', 'istek', 'kabul')),
  kelam_id uuid references public.kelamlar(id) on delete cascade,
  okundu boolean not null default false,
  olusturma timestamptz not null default now()
);
create index bildirimler_alici_idx on public.bildirimler (alici, id desc);
create index bildirimler_kimden_idx on public.bildirimler (kimden);
create index bildirimler_kelam_idx on public.bildirimler (kelam_id);

create table public.suffe_dersler (
  id integer generated always as identity primary key,
  kategori text not null check (kategori in ('siber', 'yazilim', 'adap')),
  baslik text not null,
  ozet text not null,
  sure_dk integer not null default 10,
  ikon text not null default 'book-open-variant',
  icerik text not null default '',
  sira integer not null default 0,
  yayinda boolean not null default true
);

create table public.suffe_ilerleme (
  kisi_id uuid not null references public.profiller(id) on delete cascade,
  ders_id integer not null references public.suffe_dersler(id) on delete cascade,
  yuzde integer not null default 0 check (yuzde between 0 and 100),
  guncelleme timestamptz not null default now(),
  primary key (kisi_id, ders_id)
);
create index suffe_ilerleme_ders_idx on public.suffe_ilerleme (ders_id);

create table public.sikayetler (
  id bigint generated always as identity primary key,
  bildiren uuid not null references public.profiller(id) on delete cascade,
  kelam_id uuid references public.kelamlar(id) on delete cascade,
  hedef_kisi uuid references public.profiller(id) on delete cascade,
  sebep text not null check (char_length(sebep) between 2 and 300),
  durum text not null default 'yeni' check (durum in ('yeni', 'incelendi')),
  olusturma timestamptz not null default now()
);
create index sikayetler_bildiren_idx on public.sikayetler (bildiren);
create index sikayetler_kelam_idx on public.sikayetler (kelam_id);
create index sikayetler_hedef_idx on public.sikayetler (hedef_kisi);

-- ============ YARDIMCI FONKSİYONLAR ============

create function public.yonetim_mi() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiller where id = (select auth.uid()) and rol = 'yonetim');
$$;

-- Bir yazarın kelamlarını görebilir miyim? (İzole Kimlik kuralı)
create function public.gorebilir(p_yazar uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_yazar = (select auth.uid())
      or not exists (select 1 from public.profiller where id = p_yazar and izole)
      or exists (select 1 from public.yoldasliklar
                  where takip_eden = (select auth.uid()) and takip_edilen = p_yazar and durum = 'onayli');
$$;

-- ============ TETİKLEYİCİLER ============

-- Yeni üye: profil + hoş geldin bildirimi
create function public.yeni_kullanici() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kunye text := lower(coalesce(new.raw_user_meta_data ->> 'kunye', ''));
  v_isim text := btrim(coalesce(new.raw_user_meta_data ->> 'isim', ''));
  v_yedek text := 'yoldas_' || substr(replace(new.id::text, '-', ''), 1, 10);
begin
  if v_kunye !~ '^[a-z0-9_]{3,20}$' or exists (select 1 from public.profiller where kunye = v_kunye) then
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

create trigger erkam_yeni_kullanici after insert on auth.users
  for each row execute function public.yeni_kullanici();

-- Kelam yazılmadan önce: mühürleri düzelt, cevabı tek seviyeye indir, hız sınırı
create function public.kelam_once() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ust public.kelamlar;
  v_muhur text[];
begin
  new.tasdik_sayisi := 0;
  new.cevap_sayisi := 0;
  new.olusturma := now();
  new.icerik := btrim(new.icerik);

  select coalesce(array_agg(m), '{}') into v_muhur from (
    select distinct m from (
      select regexp_replace(lower(btrim(x)), '[^a-z0-9çğıöşü_]', '', 'g') as m
        from unnest(coalesce(new.muhurler, '{}')) x
    ) s where char_length(m) between 2 and 30
    limit 5
  ) t;
  new.muhurler := v_muhur;

  if new.ust_id is not null then
    select * into v_ust from public.kelamlar where id = new.ust_id;
    if not found then raise exception 'kelam_yok'; end if;
    if not public.gorebilir(v_ust.yazar) then raise exception 'yetki_yok'; end if;
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

create trigger erkam_kelam_once before insert on public.kelamlar
  for each row execute function public.kelam_once();

-- Kelam yazıldıktan sonra: cevap sayacı, cevap ve etiket bildirimleri
create function public.kelam_sonra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ust_yazar uuid;
begin
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
       and p.id is distinct from v_ust_yazar;
  return new;
end $$;

create trigger erkam_kelam_sonra after insert on public.kelamlar
  for each row execute function public.kelam_sonra();

create function public.kelam_silindi() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.ust_id is not null then
    update public.kelamlar set cevap_sayisi = greatest(cevap_sayisi - 1, 0) where id = old.ust_id;
  end if;
  return old;
end $$;

create trigger erkam_kelam_silindi after delete on public.kelamlar
  for each row execute function public.kelam_silindi();

-- Tasdik: sayaç + bildirim
create function public.tasdik_degisti() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_yazar uuid;
begin
  if tg_op = 'INSERT' then
    update public.kelamlar set tasdik_sayisi = tasdik_sayisi + 1 where id = new.kelam_id
      returning yazar into v_yazar;
    if v_yazar is not null and v_yazar <> new.kisi_id then
      insert into public.bildirimler (alici, kimden, tur, kelam_id)
        values (v_yazar, new.kisi_id, 'tasdik', new.kelam_id);
    end if;
    return new;
  else
    update public.kelamlar set tasdik_sayisi = greatest(tasdik_sayisi - 1, 0) where id = old.kelam_id;
    delete from public.bildirimler
     where tur = 'tasdik' and kimden = old.kisi_id and kelam_id = old.kelam_id;
    return old;
  end if;
end $$;

create trigger erkam_tasdik_degisti after insert or delete on public.tasdikler
  for each row execute function public.tasdik_degisti();

-- Yoldaşlık: izole hesaba istek, diğerine doğrudan
create function public.yoldaslik_once() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.olusturma := now();
  if exists (select 1 from public.profiller where id = new.takip_edilen and izole) then
    new.durum := 'bekliyor';
  else
    new.durum := 'onayli';
  end if;
  return new;
end $$;

create trigger erkam_yoldaslik_once before insert on public.yoldasliklar
  for each row execute function public.yoldaslik_once();

create function public.yoldaslik_sonra() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.bildirimler (alici, kimden, tur)
      values (new.takip_edilen, new.takip_eden, case when new.durum = 'bekliyor' then 'istek' else 'yoldas' end);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.durum = 'bekliyor' and new.durum = 'onayli' then
      delete from public.bildirimler
       where alici = new.takip_edilen and kimden = new.takip_eden and tur = 'istek';
      insert into public.bildirimler (alici, kimden, tur)
        values (new.takip_edilen, new.takip_eden, 'yoldas'), (new.takip_eden, new.takip_edilen, 'kabul');
    end if;
    return new;
  else
    delete from public.bildirimler
     where alici = old.takip_edilen and kimden = old.takip_eden and tur in ('istek', 'yoldas');
    return old;
  end if;
end $$;

create trigger erkam_yoldaslik_sonra after insert or update or delete on public.yoldasliklar
  for each row execute function public.yoldaslik_sonra();

-- Mesaj: hız sınırı
create function public.mesaj_once() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.okundu := false;
  new.olusturma := now();
  new.icerik := btrim(new.icerik);
  if (select count(*) from public.mesajlar
       where gonderen = new.gonderen and olusturma > now() - interval '1 minute') >= 40 then
    raise exception 'cok_hizli';
  end if;
  return new;
end $$;

create trigger erkam_mesaj_once before insert on public.mesajlar
  for each row execute function public.mesaj_once();

-- ============ GÜVENLİK (RLS) ============

alter table public.profiller enable row level security;
alter table public.kelamlar enable row level security;
alter table public.tasdikler enable row level security;
alter table public.heybe enable row level security;
alter table public.yoldasliklar enable row level security;
alter table public.mesajlar enable row level security;
alter table public.bildirimler enable row level security;
alter table public.suffe_dersler enable row level security;
alter table public.suffe_ilerleme enable row level security;
alter table public.sikayetler enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- profiller: üyeler birbirinin künyesini görür; herkes yalnız kendi profilini düzenler
grant select on public.profiller to authenticated;
grant update (isim, kunye, biyografi, avatar_yol, kapak_yol, izole) on public.profiller to authenticated;
create policy profil_gor on public.profiller for select to authenticated using (true);
create policy profil_duzenle on public.profiller for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- kelamlar
grant select, delete on public.kelamlar to authenticated;
grant insert (yazar, ust_id, icerik, kategori, muhurler, gorsel_yol) on public.kelamlar to authenticated;
create policy kelam_gor on public.kelamlar for select to authenticated
  using (public.gorebilir(yazar));
create policy kelam_yaz on public.kelamlar for insert to authenticated
  with check (yazar = (select auth.uid()));
create policy kelam_sil on public.kelamlar for delete to authenticated
  using (yazar = (select auth.uid()) or public.yonetim_mi());

-- tasdikler
grant select, insert, delete on public.tasdikler to authenticated;
create policy tasdik_gor on public.tasdikler for select to authenticated using (true);
create policy tasdik_ekle on public.tasdikler for insert to authenticated
  with check (kisi_id = (select auth.uid())
              and exists (select 1 from public.kelamlar k where k.id = kelam_id));
create policy tasdik_sil on public.tasdikler for delete to authenticated
  using (kisi_id = (select auth.uid()));

-- heybe: tamamen kişiye özel
grant select, insert, delete on public.heybe to authenticated;
create policy heybe_gor on public.heybe for select to authenticated using (kisi_id = (select auth.uid()));
create policy heybe_ekle on public.heybe for insert to authenticated
  with check (kisi_id = (select auth.uid())
              and exists (select 1 from public.kelamlar k where k.id = kelam_id));
create policy heybe_sil on public.heybe for delete to authenticated using (kisi_id = (select auth.uid()));

-- yoldaşlıklar: herkes yalnız kendi tarafı olduğu bağları görür
grant select, insert, delete on public.yoldasliklar to authenticated;
grant update (durum) on public.yoldasliklar to authenticated;
create policy yoldas_gor on public.yoldasliklar for select to authenticated
  using (takip_eden = (select auth.uid()) or takip_edilen = (select auth.uid()));
create policy yoldas_ekle on public.yoldasliklar for insert to authenticated
  with check (takip_eden = (select auth.uid()));
create policy yoldas_onay on public.yoldasliklar for update to authenticated
  using (takip_edilen = (select auth.uid())) with check (takip_edilen = (select auth.uid()));
create policy yoldas_sil on public.yoldasliklar for delete to authenticated
  using (takip_eden = (select auth.uid()) or takip_edilen = (select auth.uid()));

-- mesajlar: yalnız iki taraf
grant select on public.mesajlar to authenticated;
grant insert (gonderen, alici, icerik) on public.mesajlar to authenticated;
grant update (okundu) on public.mesajlar to authenticated;
create policy mesaj_gor on public.mesajlar for select to authenticated
  using (gonderen = (select auth.uid()) or alici = (select auth.uid()));
create policy mesaj_yaz on public.mesajlar for insert to authenticated
  with check (gonderen = (select auth.uid()));
create policy mesaj_okundu on public.mesajlar for update to authenticated
  using (alici = (select auth.uid())) with check (alici = (select auth.uid()));

-- bildirimler: yalnız sahibi; yazan taraf yalnız tetikleyiciler
grant select, delete on public.bildirimler to authenticated;
grant update (okundu) on public.bildirimler to authenticated;
create policy bildirim_gor on public.bildirimler for select to authenticated using (alici = (select auth.uid()));
create policy bildirim_okundu on public.bildirimler for update to authenticated
  using (alici = (select auth.uid())) with check (alici = (select auth.uid()));
create policy bildirim_sil on public.bildirimler for delete to authenticated using (alici = (select auth.uid()));

-- suffe
grant select on public.suffe_dersler to authenticated;
create policy ders_gor on public.suffe_dersler for select to authenticated using (yayinda or public.yonetim_mi());
grant select, insert on public.suffe_ilerleme to authenticated;
grant update (yuzde, guncelleme) on public.suffe_ilerleme to authenticated;
create policy ilerleme_gor on public.suffe_ilerleme for select to authenticated using (kisi_id = (select auth.uid()));
create policy ilerleme_ekle on public.suffe_ilerleme for insert to authenticated with check (kisi_id = (select auth.uid()));
create policy ilerleme_guncelle on public.suffe_ilerleme for update to authenticated
  using (kisi_id = (select auth.uid())) with check (kisi_id = (select auth.uid()));

-- şikâyetler: herkes gönderir, yalnız yönetim okur
grant select, insert on public.sikayetler to authenticated;
create policy sikayet_ekle on public.sikayetler for insert to authenticated with check (bildiren = (select auth.uid()));
create policy sikayet_gor on public.sikayetler for select to authenticated using (public.yonetim_mi());

-- ============ GÖRSEL DEPOSU ============

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gorseller', 'gorseller', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy erkam_gorsel_yukle on storage.objects for insert to authenticated
  with check (bucket_id = 'gorseller' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy erkam_gorsel_guncelle on storage.objects for update to authenticated
  using (bucket_id = 'gorseller' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy erkam_gorsel_sil on storage.objects for delete to authenticated
  using (bucket_id = 'gorseller' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============ CANLI AKIŞ ============

alter publication supabase_realtime add table public.mesajlar;
alter publication supabase_realtime add table public.bildirimler;
