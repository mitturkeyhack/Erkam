# ERKAM veritabanı yedeği

GitHub Actions her gece 03:17'de (İstanbul) `Veritabanı yedeği` iş akışını çalıştırır. Yedek AES-256 ile şifrelenir ve 14 gün saklanır. Depo herkese açık olduğu için yedek **şifresiz asla yüklenmez**.

## Kurulum (bir kez)
1. Supabase → proje → **Connect** → **Session pooler** bağlantı adresini kopyala, `[YOUR-PASSWORD]` yerine veritabanı şifresini yaz.
2. GitHub → depo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL` = 1. adımdaki adres
   - `YEDEK_PAROLA` = uzun, rastgele bir parola (bunu ayrıca güvenli bir yerde sakla)
3. **Actions → Veritabanı yedeği → Run workflow** ile ilk yedeği elle dene.

## Geri yükleme
```sh
gpg --batch --passphrase "PAROLA" -d erkam-yedek.tar.gpg | tar x
pg_restore --no-owner --no-privileges --clean --if-exists -d "BAGLANTI" public.dump
pg_restore --no-owner --data-only -d "BAGLANTI" auth.dump
pg_restore --no-owner --data-only -d "BAGLANTI" storage.dump
```
Fotoğraf ve videoların kendisi bu yedekte yoktur (yalnızca kayıtları); onlar Supabase Storage'da durur.
