# QuickDrop — Midnight Glass

11 Oktober 2026. Desain diperbarui berdasarkan tiga referensi yang diberikan
pengguna. Arah ini menggantikan Pearl Glass yang terlalu terang dan solid.

## Penerapan referensi

- Latar midnight navy, panel smoky glass transparan, tepi tipis yang memantulkan
  cahaya, serta bayangan lembut.
- Cahaya violet, pink, dan cyan dengan bola mengilap serta cincin prismatik di
  belakang panel. Bentuk tetap terlihat kabur melalui kaca.
- Bingkai kaca besar pada desktop dan satu panel utama pada mobile.
- Heading Manrope, teks terang, aksen lavender, dan tombol violet–plum.
- Timer memakai kapsul gelap agar tetap terbaca di atas cahaya cyan.
- QR tetap hitam di atas putih agar dapat dipindai.

ui-ux-pro-max memberikan kecocokan eksplisit Glassmorphism: transparansi berlapis,
blur, cahaya, latar berwarna, dan border tipis. Hasil agregat Flat Design tidak
dipakai karena bertentangan dengan referensi. Pencarian performa Next.js tidak
menemukan kecocokan; pembatasan blur mengikuti pedoman CSS umum. Komposisi memakai
frontend-design. Dekorasi dibuat dengan CSS tanpa gambar besar.

## Penyempurnaan terbaru

- Logo memakai lilac lebih terang dengan glow violet agar menonjol.
- Bubble bergerak dalam siklus 18–22 detik, ring bergerak dan berputar perlahan
  dalam 26–30 detik. Hanya transform yang dianimasikan; blur tetap.
- Tiga langkah menjadi timeline 8 detik: garis mengisi, indikator langkah
  menyala berurutan, lalu memudar dan reset. Ini ilustrasi cara berbagi file.
- Timeline mobile berada di bawah panel transfer.
- Tombol jeda dihapus sesuai permintaan terbaru. Reduced motion tetap
  menonaktifkan loop dan menampilkan langkah statis.
- Kicker, topline panel, caption perangkat, dan kalimat tambahan receive yang
  diminta pengguna dihapus.
- Privasi dan batas penggunaan tersedia sekali dalam native disclosure bersama
  “Yang perlu kamu tahu”, dengan segitiga expand/collapse dan dukungan keyboard.
  Kedua label menggunakan ukuran font yang sama (14 px).
- Teks footer “Jarak boleh jauh. File tetap dekat.” dihapus.
- Slogan baru “Your files. Any device.” / “File kamu. Lintas perangkat.”
- Ilustrasi SVG baru memperlihatkan ponsel, paket file di jalur berpanah, dan
  laptop penerima dengan tanda selesai. SVG tetap tajam tanpa gambar eksternal.
- Inggris menjadi bahasa default; switch EN/ID di kanan atas menyimpan pilihan
  di localStorage, mengubah atribut lang, dan menerjemahkan form, dialog, error,
  feedback, timer serta label aksesibilitas tanpa mereset file atau kode.

Pencarian UX ui-ux-pro-max memverifikasi pedoman Reduced Motion. Pedoman Continuous
Animation menyarankan menghindari loop dekoratif; permintaan pengguna untuk loop
diikuti dengan gerakan lambat dan dukungan reduced motion. Kontrol jeda kemudian
dihapus atas permintaan pengguna. Pencarian pemilih bahasa tidak menemukan
kecocokan khusus; label dan switch mengikuti pedoman aksesibilitas umum.

## Verifikasi

- 30 pemeriksaan browser lulus pada Chromium desktop dan emulasi Pixel 7,
  dijalankan dengan dua worker. Termasuk teks yang dihapus, disclosure keyboard,
  pengisian dan reset timeline, reduced motion, bahasa default Inggris,
  switch keyboard, persistensi pilihan bahasa, file/kode yang tetap tersimpan,
  terjemahan error serta hasil receive dan format angka.
- ESLint, TypeScript, Prettier, dan build produksi lulus.
- Pemeriksaan lebar 320, 360, 600, 821, 1000, dan 1280 px tidak menemukan overflow
  horizontal. Pada kedua bahasa, tombol utama awal berakhir di y=744,11 pada
  lebar 320 px dan y=720,31 pada lebar 360 px.
- Screenshot desktop, tablet, mobile, hasil transfer, dan dialog diperiksa.
- Pengukuran teks terhadap screenshot latar kaca yang dikomposisi dilakukan pada
  home 1440 px, home 320 px, dan hasil receive 320 px pada fase animasi 6,4 detik.
  Sampel teks normal terendah adalah 5,61:1; titik dekoratif pada logo desktop
  4,19:1. Ini pemeriksaan sampel, bukan klaim kepatuhan WCAG penuh.
- Teks putih pada kedua ujung gradien tombol mempunyai kontras 5,80:1 dan 6,56:1;
  pada state hover 4,90:1 dan 5,56:1.
- Reduced motion menonaktifkan animasi panel, latar, dan timeline. Browser tanpa backdrop-filter
  mendapatkan permukaan gelap solid; fallback diperiksa dari kode.
- Screenshot tes menunggu interaksi React sebelum menyembunyikan caret, sehingga
  diagnostik hydration akibat screenshot terlalu awal tidak muncul pada run akhir.
- Build produksi diperiksa pada empat fase timeline (0 / 4 / 6,4 / 8 detik):
  scale garis 0 / 0,692 / 1 / 0, dengan indikator langkah tersinkronisasi.
  Transform bubble dan ring berubah. Tidak ada page error JavaScript pada capture.

Tes memakai server terisolasi dengan kredensial dikosongkan dan endpoint Supabase
diarahkan ke localhost port 9. Setiap tes memerlukan QD_SETUP melalui GET status
sebelum interaksi browser. API browser dimock dan HTTPS eksternal diblokir.
Tidak ada perubahan database, bucket, policy, atau implementasi API backend.

Safari, perangkat fisik, screen reader, pembesaran teks, dan high-contrast OS
belum diuji.

## Screenshot

- [Desktop](artifacts/night-glass/home-1440.png)
- [Tablet](artifacts/night-glass/home-821.png)
- [Mobile](artifacts/night-glass/home-360.png)
- [Receive mobile](artifacts/night-glass/receive-results-320.png)
- [Transfer siap](artifacts/night-glass/ready-desktop.png)
- [Dialog mobile](artifacts/night-glass/dialog-mobile.png)
- [Timeline desktop](artifacts/night-glass/motion-1440-6400.png)
- [Timeline mobile](artifacts/night-glass/motion-320-6400.png)
- [Privasi mobile](artifacts/night-glass/privacy-320.png)
- [Desktop Inggris](artifacts/bilingual/home-en-1440.png)
- [Desktop Indonesia](artifacts/bilingual/home-id-1440.png)
- [Mobile Inggris](artifacts/bilingual/home-en-320.png)
- [Privasi Indonesia](artifacts/bilingual/privacy-id-320.png)
