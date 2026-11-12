-- 014: kelam medyasında "kucuk" (akış önizlemesi) alanına izin ver. kelam_once içindeki beyaz listeye eklenir.
do $$
declare d text;
begin
  select pg_get_functiondef('public.kelam_once()'::regprocedure) into d;
  if position('''kucuk''' in d) > 0 then return; end if;
  d := replace(d, $r$'tur', e ->> 'tur', 'yol', e ->> 'yol', 'kapak', e ->> 'kapak',$r$,
                  $r$'tur', e ->> 'tur', 'yol', e ->> 'yol', 'kapak', e ->> 'kapak',
           'kucuk', case when e ->> 'kucuk' like new.yazar::text || '/%' then e ->> 'kucuk' end,$r$);
  if position('''kucuk''' in d) = 0 then raise exception 'degistirilemedi'; end if;
  execute d;
end $$;
