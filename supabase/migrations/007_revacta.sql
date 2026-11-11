-- Revaçta: son 24 saatte (az ise 7 gün, o da azsa tüm zamanlar) en çok kelamda geçen mühürler
create or replace function public.revacta()
returns jsonb language plpgsql stable set search_path = '' as $$
declare v jsonb; p text;
begin
  foreach p in array array['24 saat', '7 gün', 'tümü'] loop
    select coalesce(jsonb_agg(jsonb_build_object('muhur', m, 'sayi', n, 'yoldas', y) order by n desc, y desc, m), '[]'::jsonb)
      into v
      from (select m, count(*) as n, count(distinct k.yazar) as y
              from public.kelamlar k, unnest(k.muhurler) m
             where k.ust_id is null
               and (p = 'tümü' or k.olusturma > now() - case p when '24 saat' then interval '24 hours' else interval '7 days' end)
             group by m order by count(*) desc, count(distinct k.yazar) desc, m limit 10) s;
    if jsonb_array_length(v) >= 3 or p = 'tümü' then
      return jsonb_build_object('pencere', p, 'liste', v);
    end if;
  end loop;
  return jsonb_build_object('pencere', 'tümü', 'liste', '[]'::jsonb);
end $$;
revoke execute on function public.revacta() from public, anon;
grant execute on function public.revacta() to authenticated;
