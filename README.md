# Website Penyuluh Agama Islam 2026 — Data Lokal + AI

Versi siap deploy ke Vercel tanpa Supabase.

## Fitur
- Data website tersimpan di browser (localStorage).
- PDF lokal dapat disimpan di IndexedDB browser.
- Galeri lokal dengan layout dinamis/masonry, hover, tanggal, dan lightbox Next/Previous.
- Sahabat KUA dengan tampilan chat modern, avatar `assets/profile.jpg`, tombol floating, topik cepat, dan percakapan seperti petugas KUA.
- Sahabat KUA menggunakan `/api/chat` dan `GEMINI_API_KEY` dari Vercel.
- AI tetap dapat menjawab pertanyaan di luar materi lokal; materi lokal hanya menjadi konteks tambahan.

## Vercel
1. Upload/import folder ini sebagai project baru.
2. Isi `GEMINI_API_KEY` di Environment Variables.
3. Deploy / Redeploy.

Catatan: mode lokal menyimpan perubahan admin pada browser/perangkat yang digunakan. Untuk penyimpanan bersama lintas perangkat, Supabase/DB dapat ditambahkan pada tahap berikutnya.

- **Formulir Catin Online**: form calon pengantin, validasi NIK 16 digit, penyimpanan lokal, dan pengelolaan data dari Dashboard Admin.
- Menu **Formulir Catin** sudah ditambahkan ke navigasi utama.


## Berita gaya surat kabar
- Klik foto atau tombol **Baca selengkapnya** untuk membuka pembaca berita penuh.
- Tampilan detail memakai judul besar, foto utama, tanggal/lokasi, isi artikel dengan tipografi surat kabar, drop cap, sidebar informasi, berita terkait, dan tombol bagikan/salin link.
- Berita tetap dikelola dari Dashboard Admin → Berita.


## Fitur terbaru — Detail Berita
- Setiap berita memiliki URL sendiri dengan format `/berita/judul-berita`.
- Tombol Berita & Foto membuka halaman/detail berita dengan tampilan artikel bergaya surat kabar.
- URL dapat dibagikan dan dibuka langsung di tab baru.
- Vercel sudah dikonfigurasi dengan rewrite `/berita/:slug` ke aplikasi utama agar direct URL tidak 404.


AI SAHABAT KUA
- Menggunakan OpenAI Responses API.
- Model default: gpt-5.6-luna.
- Wajib mengisi GEMINI_API_KEY di Vercel dan melakukan Redeploy setelah mengubah variable.
- Model dapat diubah melalui variable GEMINI_MODEL; default `gemini-3.8-flash`.
