-- 015: hesap silinirken uygulama kişinin kendi klasöründeki dosyaları listeleyip silebilsin (yalnızca kendi klasörü)
drop policy if exists erkam_gorsel_listele on storage.objects;
create policy erkam_gorsel_listele on storage.objects for select to authenticated
  using (bucket_id = 'gorseller' and (storage.foldername(name))[1] = (select auth.uid())::text);
