# Bukti pengujian — 11 Oktober 2026

## Environment

Windows, Node v24.21.0, npm 10.2.3. Next.js 16.4.0, React 19.3.0, Supabase JS 2.117.3, Vitest 5.0.3, Playwright 1.64.0. Versi lengkap dipin oleh package-lock.json. Environment Supabase runtime sudah lengkap setelah login CLI resmi; nilai credentials tidak dicatat.

## Hasil aktual

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | Exit 0; seluruh halaman/API terkompilasi; Node route handlers, halaman home/receive statis |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0; tanpa error/warning lint |
| `npm test` | 26 tes lolos dalam 5 berkas |
| `npm run test:e2e` | 14 tes lolos: Chromium desktop dan emulasi mobile |
| Mobile 360 px | Lebar halaman tidak melebihi viewport; screenshot diperiksa |
| Bundle browser | Tidak ditemukan identifier 5 secret server pada `.next/static`; nilai secret nyata belum dikonfigurasi |
| Kontras teks | Warna teks kecil yang lemah digelapkan; audit warna hex terhadap putih tidak menemukan rasio <4.5. Ini bukan audit WCAG lengkap |

## Yang diuji

- Validator: 0 byte, batas file/total, 6 file, pasangan MIME/ekstensi, Office/HEIC, normalisasi leading zero, sanitasi path/control/bidi.
- Token dan replay: token acak, HMAC terpisah, AES-GCM, nonce berbeda, ciphertext tampering ditolak.
- API: body metadata maksimum 16 KB, multipart ditolak, token/idempotency key dibatasi format.
- Auth worker: helper autentikasi **yang digunakan handler** menerima hanya POST dengan secret sah, menolak salah/hilang/terlalu panjang/GET. Gateway dan handler live belum diuji.
- PostgreSQL lokal PGlite menjalankan migration asli: 7 tabel RLS aktif, anon ditolak tabel/RPC, init replay/conflict, completion bersamaan, collision kode, ukuran berbeda, owner vs receive, file lintas transfer, batas 10 grant, revoke saat signing, pending lease expiry tanpa refund, cleanup failure, lease ganda, tombstone, final release tepat sekali, rate limit dan capacity guard.
- Browser: tab keyboard, paste `0012 3456`, validasi batch, missing environment error, fragment dihapus sebelum exchange, countdown dengan jam dibekukan dan render ulang, daftar/attachment download, sender upload via XHR, kode/QR, session recovery, Escape pada dialog dan revoke.

Tes alur sender/receive/download menggunakan API/Storage mock. Tes missing-env memakai route Next.js nyata tanpa Supabase credentials. PGlite adalah PostgreSQL lokal satu engine; bukan uji contention multi-koneksi Supabase.

Screenshot lokal (mock untuk state ready):

- [Desktop home](artifacts/chromium-home.png)
- [Mobile home 360 px](artifacts/mobile-home.png)
- [Desktop ready](artifacts/chromium-ready.png)
- [Mobile ready](artifacts/mobile-ready.png)

## Belum diverifikasi

Sweep late upload dan final purge setelah credential lifetime; signed URL/cache expiry nyata; Safari iOS, Chrome Android nyata; dua perangkat/jaringan berbeda; contention multi-koneksi yang lebih luas; response/provider failure di jaringan nyata; pilot/egress/p95. Tidak ada deployment Vercel.

## Batch remote yang disetujui

Pengguna mengonfirmasi target `iqhllyxufmeocbkrwopr` dan memberi izin batch Supabase. Pemeriksaan ulang sebelum write: tabel public, bucket dan migration kosong.

- Migration remote: `20261011092942_quickdrop_core`, `20261011093042_quickdrop_cleanup_extensions`, `20261011093548_quickdrop_cleanup_schedule`. Berkas lokal memakai versi yang sama.
- 7 tabel RLS aktif; anon/authenticated tidak punya SELECT. Semua 13 RPC `qd_*` tidak dapat dieksekusi anon/authenticated, dapat dieksekusi service_role; search_path eksplisit.
- Bucket `transfers`: private, batas 25.000.000 byte, 19 MIME yang diizinkan. Dibuat lewat Storage SDK; tidak ada write SQL ke tabel Storage internal.
- Worker `cleanup-transfers` versi 1 ACTIVE; request tanpa secret 401, secret sah 200. Sweep awal `{claimed:0,swept:0,failed:0}`.
- Vault menyimpan dua secret bernama QuickDrop; nilai tidak dicatat. Ekstensi pg_cron/pg_net aktif dan job `quickdrop-cleanup-transfers` aktif tiap 5 menit.
- Eksekusi Cron otomatis pertama `2026-10-11T09:40:00Z`: job succeeded, respons pg_net HTTP 200, tidak timeout/error, worker `{claimed:0,swept:0,failed:0}` dan heartbeat `2026-10-11T09:40:00.961529Z`.
- Security advisor hanya INFO [RLS Enabled No Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) pada 7 tabel: ini sesuai desain server-only, tanpa grant publik. Performance advisor INFO [Unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) pada tiga FK dan [Unused Index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) pada dua indeks di database baru; belum dioptimalkan.

## Tes live

`npm run test:integration` exit 0 pada `2026-10-11T09:36:59.246Z`, Supabase nyata + Next.js lokal.

- Private bucket/limit dan penolakan tabel/RPC/Storage anonim.
- Dua fixture teks diunggah langsung melalui signed Storage URL; download attachment cocok SHA-256 dengan sumber.
- Init/grant replay, completion bersamaan dengan hasil sama, token receive ditolak sebagai owner.
- Expiry fixture menghasilkan respons unavailable generik; worker menghapus objek, tombstone tetap ada.
- Setelah tes: Storage berisi 0 objek, satu tombstone fixture berstatus deleting menahan reservasi 50 MB sampai `2026-10-11T11:48:50.629584Z` (18:48:50 WIB). Final purge masih perlu bukti dari sweep sesudah waktu tersebut.
- Flag `ENABLE_LIVE_TESTS` dikembalikan ke false.
- `npm test` diulang setelah sinkronisasi nama migration: 26 tes lolos, 5 berkas.
- `npm run lint` dan `npm run typecheck` diulang: exit 0. Preview lokal HTTP 200, environment target benar, 3 secret berbeda, encryption key 32 byte dan live tests false.

Untuk memenuhi Definition of Done PRD, lanjutkan verifikasi final purge/late upload dan pengujian perangkat/jaringan nyata. Jangan menandai MVP siap pilot hanya dari hasil lokal dan fixture di atas.
