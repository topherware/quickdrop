# QuickDrop

Transfer file antarperangkat tanpa akun. Next.js App Router + TypeScript + Tailwind, Supabase PostgreSQL/private Storage, Vercel sebagai target hosting.

## Status

Batch Supabase pada `iqhllyxufmeocbkrwopr` sudah disetujui dan diterapkan: 7 tabel RLS, 13 RPC, bucket private `transfers` (25 MB/file), worker terautentikasi, Vault dan Cron tiap 5 menit. `.env.local` sudah lengkap; anchor penggunaan `2026-10-11T00:00:00+07:00` mengikuti tanggal pengguna. Tes live upload/download, hash, RLS, expiry dan first cleanup sweep lolos. Lihat [bukti aktual](TEST_EVIDENCE.md) untuk batas verifikasi scheduler/final purge. Belum ada deployment publik.

## Menjalankan lokal

```powershell
npm ci
# .env.local sudah disiapkan; jangan menimpanya dengan .env.example.
# Environment lokal sudah lengkap; jangan kirim key ke chat.
npm run dev
```

Buka http://127.0.0.1:3000. `APP_ORIGIN` harus persis sama dengan origin browser, tanpa trailing slash. Jika memakai localhost, ubah APP_ORIGIN dan URL yang dibuka secara konsisten. Perubahan environment membutuhkan restart.

Versi dependency aktual ada di package-lock.json. Next 16.4.0, React 19.3.0, Supabase JS 2.117.3. Node 24 digunakan saat development. `npm ci` mereproduksi lockfile.

`CODE_HMAC_SECRET`, `RATE_LIMIT_HMAC_SECRET` dan `CLEANUP_SECRET` harus berbeda dan acak, minimal 32 karakter. `TOKEN_ENCRYPTION_KEY` adalah 32 byte dalam base64 standar (44 karakter, diakhiri `=`). Buat secara lokal dengan Node crypto; jangan commit nilai secret. `USAGE_PERIOD_START` adalah ISO timestamp awal siklus penggunaan yang dikonfigurasi pemilik, bukan otomatis tanggal 1. Jika anchor dimajukan, estimasi egress direset pada init berikutnya; lakukan hanya saat periode provider benar-benar berubah.

Runtime browser tidak menggunakan MCP/OAuth dan tidak membutuhkan service-role/publishable key. Signed upload diberikan backend untuk path UUID tertentu. Publishable key pada `.env.local` hanya diperlukan oleh tes RLS live. Service role hanya digunakan server dan worker.

## Setup Supabase setelah target/batch disetujui

1. Reference sudah dikonfirmasi dan [core migration](supabase/migrations/20261011092942_quickdrop_core.sql) sudah diterapkan melalui MCP. Riwayat lokal mengikuti versi remote. Jangan menerapkannya lagi. Lihat [status batch](IMPLEMENTATION_PLAN.md).
2. Bucket private `transfers` sudah dibuat melalui Storage SDK resmi. `npm run setup:bucket` dapat memeriksa bucket yang sudah ada tanpa menimpanya. Jangan menulis ke `storage.buckets`/`storage.objects` via SQL.
3. Secret worker sudah dipasang lewat CLI resmi dari `.env.cleanup.local`. Bila perlu memasangnya ulang setelah rotasi yang disetujui, gunakan `npx supabase secrets set --project-ref iqhllyxufmeocbkrwopr --env-file .env.cleanup.local`. Built-in `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` tersedia di worker. Jangan menempel secrets ke chat atau file migration. Rotasi harus memperbarui Vault secara konsisten.
4. Worker `cleanup-transfers` versi 1 sudah ACTIVE. Gateway `verify_jwt=false` karena Cron memakai dedicated shared secret; handler memverifikasi digest secara constant-time **sebelum** DB/Storage. Request tanpa secret harus 401 setelah environment secret terpasang; sebelum itu handler mengembalikan 503.
5. Vault `quickdrop_cleanup_url` dan `quickdrop_cleanup_secret` sudah dibuat dan sesuai secret worker. Job `quickdrop-cleanup-transfers` sudah aktif, jadwal `*/5 * * * *`; jangan menjalankan ulang [cron.sql](supabase/setup/cron.sql) pada target ini. Script berhenti jika job sudah ada; inspeksi sebelum mengubah.
6. Request worker tanpa secret sudah diverifikasi 401, dengan secret 200; heartbeat diperbarui oleh worker asli. Init ditolak saat heartbeat belum ada atau lebih tua dari 10 menit. Jangan memalsukan heartbeat sebagai pengganti scheduler.
7. Verifikasi bucket private/limit/MIME, 7 tabel RLS aktif, anon/authenticated tanpa grants, RPC hanya service_role, migration history, job aktif dan hasil eksekusi Cron. `pg_cron`/`pg_net` perlu diaktifkan; `supabase_vault` sudah terdeteksi pada inspeksi awal.
8. Setelah setup terverifikasi, jalankan tes live dengan fixture. Catat timestamp dan hasil; jangan menyimpan URL bertanda tangan/token/key dalam laporan.

Tools MCP saat inspeksi mendukung migration, query dan deploy function, tetapi tidak administrasi bucket atau secrets. Kode lokal dan petunjuk dashboard adalah fallback; setup cloud tidak dianggap selesai hanya karena berkas SQL tersedia.

## Alur dan kontrol

- 1–5 file, maksimal 25.000.000 byte per file dan 50.000.000 byte total. File kosong, script, HTML dan SVG ditolak. Office/HEIC dengan MIME kosong/octet-stream dinormalisasi; ekstensi dan MIME bukan pemeriksaan malware.
- Upload langsung browser ke Storage menggunakan XHR PUT signed URL, maksimal dua upload paralel, progress jaringan nyata. Standard upload dipilih untuk seluruh batas 25 MB agar lifetime credential tetap 2 jam; retry memeriksa objek dan melewati file yang selesai. Resumable TUS (lifetime sesi hingga 24 jam) tidak digunakan; resume setelah browser ditutup tidak dijanjikan. Koneksi yang terputus mengulang file yang belum selesai.
- Server memeriksa byte aktual melalui Storage `info` sebelum finalisasi atomik. Ukuran berbeda memicu revoke. Status bukan bukti dari browser.
- Kode CSPRNG 8 digit disimpan sebagai HMAC, token owner/share/receive 256-bit sebagai hash. Token owner terpisah; sesi pengirim memakai sessionStorage. Fragment share dihapus dari address bar sebelum POST exchange. QR dibuat lokal.
- Ready berlaku 30 menit dari finalisasi server, countdown memakai waktu server + monotonic client timer. Lookup/download memeriksa expiry database meski scheduler terlambat.
- Signed download URL attachment maksimal 60 detik, dipotong sisa umur transfer. Batas 10 grant per file ditegakkan dengan row lock. Pending/uncertain signing tetap memakai slot; tidak direfund sembarangan. Retry dengan key sama mereplay URL terenkripsi jika masih aktif. Jika grant pending karena process/network failure, slot ditahan hingga cleanup; pengguna dapat membuat key baru hanya setelah batas tetap diperiksa. Ini konservatif terhadap kuota, bukan klaim satu kali unduh.
- Init/complete idempotency terenkripsi AES-256-GCM dengan nonce unik. Init yang crash sebelum commit menjadi pending, tidak menerbitkan credential baru; tombstone dibersihkan setelah expiry. Replay key dengan metadata berbeda ditolak 409. Finalisasi bersamaan menghasilkan kode/expiry sama; collision kode di-retry maksimal 8 kali.
- Rate limit PostgreSQL atomik: init 5, lookup/exchange 10, download 30 per IP/10 menit; global init/lookup 300 dan download 1000 per 10 menit. `TRUSTED_PROXY=vercel` hanya mempercayai header Vercel; development memakai bucket lokal bersama. Jangan deploy ke proxy lain tanpa adapter IP tervalidasi. Identifier HMAC dipurge dalam 24 jam melalui worker.
- Reservasi konservatif 25 MB × jumlah slot, maksimal 750 MB. Tetap ditahan hingga credential selesai + grace. Estimasi egress 4 GB menghentikan init baru; reuse signed URL dan retry bisa membuat billing nyata lebih besar. Dashboard provider tetap acuan.
- `usage_guard.init_enabled` dan `lookup_enabled` adalah circuit breaker internal via admin/service-role, tanpa dashboard publik.

## Cleanup dan late uploads

Worker tiap 5 menit claim hingga 50 transfer, lease 2 menit, sweep via Storage API remove dan list untuk verifikasi tidak ada objek. Transfer expired/revoked tidak dapat lookup/download baru. Tombstone path dipertahankan sampai 132 menit sejak init: dua jam signed upload credential + margin issuance 2 menit + grace 10 menit. Sweep berulang menghapus file yang muncul kembali. Reservasi dilepas hanya sesudah final absence check dan penghapusan metadata atomik. Crash/retry tidak double-release; gagal Storage mempertahankan metadata dan memakai backoff.

Target normal penghapusan objek ≤10 menit setelah akses berakhir, bukan jaminan absolut. Cache/signed link/unduhan berjalan dapat mempertahankan akses sebentar. File bukan backup/arsip dan tidak memiliki E2EE atau malware scanner. Metadata tombstone bisa bertahan lebih lama daripada 30 menit.

Pantau heartbeat, `cleanup_failed`, cleanup backlog, `reserved_bytes`, estimasi egress dan dashboard Storage/egress. Worker membatasi runtime dan batch; upload baru ditolak ketika heartbeat tidak sehat. Database records pending download tidak dibebaskan sebelum transfer cleanup. Tetapkan retensi Cron run logs/pg_net yang pendek sesuai kebutuhan operasi.

## Pengujian

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit: batas, sanitasi, MIME, leading zero, token, authenticated encryption. PostgreSQL lokal melalui PGlite menjalankan migration **yang sama**, menguji RLS/grants, idempotency, collision, ownership, grant cap, cleanup/tombstone, quota dan rate limit. Ini bukan bukti integrasi Supabase Storage/Edge/Cron. PGlite menjalankan query paralel lewat satu engine; contention multi-koneksi live tetap perlu diuji.

Playwright desktop/mobile: tab keyboard, batas batch, UI tanpa env, penghapusan fragment dan download attachment dengan API mock. Jalankan pada environment **tanpa** kredensial Supabase (tes missing-env membutuhkan konfigurasi kosong). Mock tidak membuktikan transfer lintas perangkat.

Setelah remote setup/fixture writes disetujui, isi `.env.local`, jalankan app dan set `ENABLE_LIVE_TESTS=true`, lalu `npm run test:integration`. Script memverifikasi bucket, RLS anon, worker auth, upload langsung, hash SHA-256, completion bersamaan, sesi terpisah, expiry fixture dan first cleanup sweep. Tidak mengubah TTL global. Tombstone fixture harus tetap ada sampai credential habis. Verifikasi final sweep setelah 132 menit dan scheduler heartbeat sepanjang jendela itu; tidak boleh mengklaim selesai sebelum bukti.

Uji manual tambahan: dua perangkat/jaringan berbeda; JPG HP→PC, PDF PC→HP via QR; 5 file; putus jaringan; clipboard fallback; Safari iOS/Chrome Android; signed URL expiry/cache; serangan concurrency lintas koneksi; crash worker; cleanup setelah credential expiry. [TEST_EVIDENCE.md](TEST_EVIDENCE.md) mencatat hasil aktual.

## Vercel

Deployment publik memerlukan instruksi tersendiri. Gunakan satu repository/project target; tidak ada project Vercel yang dibuat otomatis. Pastikan Hobby sesuai pilot pribadi/nonkomersial dan periksa ketentuan/limit terbaru sebelum launch.

Atur semua environment server untuk environment target yang benar, `APP_ORIGIN=https://domain-resmi`, `TRUSTED_PROXY=vercel`. Pisahkan preview dari data produksi. Rebuild setelah env berubah. Payload file tidak melewati Vercel Functions; periksa Network upload/download menuju Supabase. Jalankan build, tes live dan verifikasi cleanup scheduler sebelum pilot. Tidak memerlukan Vercel Cron.

## Troubleshooting

- `QD_SETUP`: placeholder/env kosong, origin/secret/encryption key/anchor salah. UI tidak berpura-pura berhasil.
- `ORIGIN`: samakan hostname localhost/127.0.0.1, port, protokol dengan APP_ORIGIN.
- `QD_CLEANUP_STALE`: cek secret, deployment function, Vault, Cron, lease, backlog/failed cleanup. Jangan bypass heartbeat.
- `QD_CAPACITY`: objek/credential aktif menahan reservasi atau estimasi egress melewati limit. Cek dashboard dan final sweep.
- Upload gagal: cek private bucket, limit, MIME mapping, jaringan dan waktu upload. Jangan mengubah bucket menjadi public.
- `QD_PENDING`: init/grant sebelumnya belum commit; retry konservatif menjaga quota, worker menghapus orphan setelah deadline.
- Grant expired: klik Unduh lagi dengan key baru; grant pending tidak otomatis direfund.
