-- Profilde "Yoldaş Edindiği" / "Yoldaşları" listesi
create or replace function public.yoldas_listesi(p_kisi uuid, p_yon text, p_metin text default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ben uuid := (select auth.uid());
  v_ara text := nullif(lower(btrim(coalesce(p_metin, ''), ' @')), '');
begin
  if v_ben is null then raise exception 'giris_gerekli'; end if;
  if p_yon not in ('edindigi', 'yoldaslari') then raise exception 'yon_gecersiz'; end if;
  if not public.gorebilir(p_kisi) then raise exception 'izole_kimlik'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.zaman desc)
    from (
      select y.olusturma as zaman,
        public.profil_json(p) || jsonb_build_object(
          'biyografi', p.biyografi,
          'iliski', case when p.id = v_ben then 'ben'
                         else coalesce((select b.durum from public.yoldasliklar b
                                         where b.takip_eden = v_ben and b.takip_edilen = p.id), 'yok') end,
          'karsilikli', exists (select 1 from public.yoldasliklar k
                                 where k.takip_eden = p.id and k.takip_edilen = v_ben and k.durum = 'onayli')
        ) as j
      from public.yoldasliklar y
      join public.profiller p
        on p.id = case when p_yon = 'edindigi' then y.takip_edilen else y.takip_eden end
      where y.durum = 'onayli'
        and (case when p_yon = 'edindigi' then y.takip_eden else y.takip_edilen end) = p_kisi
        and (v_ara is null or p.kunye like '%' || v_ara || '%' or lower(p.isim) like '%' || v_ara || '%')
      order by y.olusturma desc
      limit 500
    ) x), '[]'::jsonb);
end $$;

revoke execute on function public.yoldas_listesi(uuid, text, text) from public, anon;
grant execute on function public.yoldas_listesi(uuid, text, text) to authenticated;
