-- Bildirimler: kelam önizlemesi ve silme
create or replace function public.bildirim_listesi(p_limit integer default 40)
 returns jsonb language sql stable set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'tur', b.tur, 'okundu', b.okundu, 'olusturma', b.olusturma, 'kelam_id', b.kelam_id, 'metin', b.metin,
      'kimden', (select public.profil_json(p) from public.profiller p where p.id = b.kimden),
      'onizleme', (select jsonb_build_object('metin', left(k.icerik, 80),
                     'gorsel', coalesce(k.medya->0->>'kucuk', case when k.medya->0->>'tur' = 'foto' then k.medya->0->>'yol' end, k.medya->0->>'kapak', k.gorsel_yol))
                   from public.kelamlar k where k.id = b.kelam_id))
      order by b.id desc), '[]'::jsonb)
    from (select * from public.bildirimler where alici = (select auth.uid())
           order by id desc limit least(greatest(coalesce(p_limit, 40), 1), 100)) b;
$$;

-- p_idler boşsa tüm bildirimlerimi siler; yalnızca kendi bildirimlerine dokunur
create or replace function public.bildirim_sil(p_idler bigint[] default null)
 returns integer language plpgsql security definer set search_path to ''
as $$
declare n integer;
begin
  if (select auth.uid()) is null then raise exception 'oturum_yok'; end if;
  delete from public.bildirimler
   where alici = (select auth.uid()) and (p_idler is null or id = any(p_idler));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.bildirim_sil(bigint[]) from public, anon;
grant execute on function public.bildirim_sil(bigint[]) to authenticated;
