-- ERKAM — kelamlara çoklu medya (en fazla 4 fotoğraf ya da 1 video)

alter table public.kelamlar add column medya jsonb not null default '[]'::jsonb;
alter table public.kelamlar drop constraint if exists kelamlar_icerik_check;
alter table public.kelamlar add constraint kelamlar_icerik_check check (char_length(icerik) <= 500);
grant insert (medya) on public.kelamlar to authenticated;

create or replace function public.kelam_once() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ust public.kelamlar;
  v_muhur text[];
  v_medya jsonb;
begin
  new.tasdik_sayisi := 0;
  new.cevap_sayisi := 0;
  new.olusturma := now();
  new.icerik := btrim(coalesce(new.icerik, ''));

  select coalesce(array_agg(m), '{}') into v_muhur from (
    select distinct m from (
      select regexp_replace(lower(btrim(x)), '[^a-z0-9çğıöşü_]', '', 'g') as m
        from unnest(coalesce(new.muhurler, '{}')) x
    ) s where char_length(m) between 2 and 30
    limit 5
  ) t;
  new.muhurler := v_muhur;

  -- medya: yalnız yazarın kendi klasöründeki dosyalar, en fazla 4; video varsa tek başına
  if jsonb_typeof(coalesce(new.medya, '[]'::jsonb)) <> 'array' then new.medya := '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'tur', e ->> 'tur', 'yol', e ->> 'yol', 'kapak', e ->> 'kapak',
           'g', case when e ->> 'g' ~ '^[0-9]{1,5}$' then (e ->> 'g')::int end,
           'y', case when e ->> 'y' ~ '^[0-9]{1,5}$' then (e ->> 'y')::int end,
           'sure', case when e ->> 'sure' ~ '^[0-9]{1,4}(\.[0-9]+)?$' then round((e ->> 'sure')::numeric, 1) end))), '[]'::jsonb)
    into v_medya
    from (select e from jsonb_array_elements(coalesce(new.medya, '[]'::jsonb)) e
           where e ->> 'tur' in ('foto', 'video')
             and e ->> 'yol' like new.yazar::text || '/%'
             and (e ->> 'kapak' is null or e ->> 'kapak' like new.yazar::text || '/%')
           limit 4) s;
  if exists (select 1 from jsonb_array_elements(v_medya) e where e ->> 'tur' = 'video') and jsonb_array_length(v_medya) > 1 then
    raise exception 'medya_gecersiz';
  end if;
  new.medya := v_medya;

  if char_length(new.icerik) = 0 and jsonb_array_length(new.medya) = 0 then
    raise exception 'bos_kelam';
  end if;

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

create or replace function public.kelam_json(k public.kelamlar) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', k.id, 'icerik', k.icerik, 'kategori', k.kategori, 'muhurler', k.muhurler,
    'gorsel_yol', k.gorsel_yol, 'medya', k.medya, 'ust_id', k.ust_id,
    'tasdik_sayisi', k.tasdik_sayisi, 'cevap_sayisi', k.cevap_sayisi, 'olusturma', k.olusturma,
    'yazar', (select public.profil_json(p) from public.profiller p where p.id = k.yazar),
    'tasdikledim', exists (select 1 from public.tasdikler t
                            where t.kelam_id = k.id and t.kisi_id = (select auth.uid())),
    'heybemde', exists (select 1 from public.heybe h
                         where h.kelam_id = k.id and h.kisi_id = (select auth.uid())));
$$;

drop function public.kelam_nakset(text, text, text[], text, uuid);
create function public.kelam_nakset(
  p_icerik text, p_kategori text default 'ilim', p_muhurler text[] default '{}',
  p_gorsel text default null, p_ust uuid default null, p_medya jsonb default '[]'::jsonb
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v public.kelamlar;
  v_ben uuid := (select auth.uid());
  v_gorsel text := p_gorsel;
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if v_gorsel is not null and v_gorsel not like v_ben::text || '/%' then v_gorsel := null; end if;
  insert into public.kelamlar (yazar, ust_id, icerik, kategori, muhurler, gorsel_yol, medya)
    values (v_ben, p_ust, coalesce(p_icerik, ''), coalesce(p_kategori, 'ilim'), coalesce(p_muhurler, '{}'),
            v_gorsel, coalesce(p_medya, '[]'::jsonb))
    returning * into v;
  return public.kelam_json(v);
end $$;
revoke execute on function public.kelam_nakset(text, text, text[], text, uuid, jsonb) from public, anon;
grant execute on function public.kelam_nakset(text, text, text[], text, uuid, jsonb) to authenticated;

-- depo: fotoğraf + mp4 video, dosya başına en fazla 50 MB
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
 where id = 'gorseller';
