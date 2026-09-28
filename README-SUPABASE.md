# Penyimpanan Permanen Supabase

1. Jalankan `SUPABASE-SETUP.sql` di Supabase SQL Editor.
2. Buka Supabase > Project Settings > API.
3. Salin **Project URL** dan **Publishable/Anon key** ke `supabase-config.js`.
4. Di Supabase Authentication > Users, buat akun admin (email + password).
5. Deploy folder ini ke Vercel.

Catatan keamanan: jangan pernah menaruh `service_role` key di frontend.
Foto/PDF yang diupload dari admin menggunakan bucket Storage `media`.
Data formulir Catin disimpan terpisah agar tidak ikut terbuka sebagai data publik website.


## Perbaikan Galeri Supabase
- Bucket yang dipakai: `website-files` (public).
- Upload memakai path `upload/...` di dalam bucket `website-files`. Jika project memiliki bucket `media` dan `website-files` tidak ditemukan, website mencoba `media` otomatis.
- Setiap foto Galeri juga dicatat ke tabel `content_items` dengan `type = galeri`, `file_path`, `file_name`, `file_type`, `file_size`, dan `image_url`.
- Saat website dibuka, Galeri membaca data `type = galeri` dari `content_items`.
- File lama tidak dihapus atau dipindahkan.


## Perbaikan versi 28 September 2026
- Tombol hapus Galeri sekarang menghapus metadata `content_items` dan file Storage Supabase.
- ID UUID galeri di-escape dengan benar sehingga tombol hapus tidak lagi menghasilkan JavaScript error.
- Data Galeri cloud tidak lagi disalin ke `site_settings`, sehingga foto yang sudah dihapus tidak muncul kembali dari cache data lama.
- `vercel.json` tidak memiliki redirect ke domain lama `website-penyuluh-agama-islam-2026-s-mu.vercel.app`.

### Jika domain tetap mengarah ke `s-mu`
Jika setelah deploy URL proyek baru masih berpindah ke `s-mu.vercel.app`, penyebabnya bukan kode ZIP ini, melainkan pengaturan Domain/Redirect pada proyek Vercel atau cache redirect 308.
Di Vercel buka **Project Settings → Domains** dan pastikan domain yang dipakai terpasang pada proyek ini. Hapus domain/redirect lama yang menunjuk ke proyek `s-mu`, lalu lakukan deployment baru. Untuk pengujian gunakan URL deployment baru langsung terlebih dahulu.
