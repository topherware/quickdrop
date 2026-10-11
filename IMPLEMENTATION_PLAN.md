# Rencana implementasi QuickDrop

Target yang terbaca dari Supabase MCP: `iqhllyxufmeocbkrwopr`.
Pengguna sudah mengonfirmasi reference dan mengizinkan batch Supabase. CLI resmi mengonfirmasi target di region `ap-southeast-1`.
Inspeksi: tidak ada tabel public, bucket Storage, atau migrations. Auth, realtime, storage, vault berisi tabel bawaan.
Tools relevan tersedia: execute_sql, apply_migration, get_project_url, list_tables, list_migrations, deploy_edge_function, get_edge_function, list_edge_functions, list_extensions, search_docs. Tool administrasi bucket dan secret tidak tersedia.

1. Bangun UI Indonesia mobile-first, pilih/drop file, progress nyata, retry, kode/QR, receive, countdown dan revoke.
2. API metadata Next.js; signed upload langsung browser; verifikasi objek sebelum ready; signed download attachment.
3. Migration lokal dengan RLS, service-role-only RPC, transaksi quota/rate limit/idempotency/grants, lease cleanup dan tombstones.
4. Worker terautentikasi, konfigurasi Cron/Vault lokal, setup bucket melalui Storage SDK resmi.
5. Unit, transaksi PostgreSQL lokal, browser, typecheck, lint, build. Tes live hanya setelah persetujuan dan environment tersedia.

## Batch remote untuk ditinjau
- Terapkan migration `20261011092942_quickdrop_core.sql`: 7 tabel aplikasi, RLS dan RPC khusus QuickDrop; tidak mengganti tabel/policy bawaan.
- Buat bucket private `transfers`, batas 25.000.000 byte, allowlist MIME melalui SDK resmi (memerlukan server key pada `.env.local`).
- Deploy `cleanup-transfers`, handler memverifikasi dedicated secret; gateway JWT dimatikan hanya karena scheduler memakai shared secret, bukan JWT.
- Aktifkan pg_cron dan pg_net; simpan URL/secret worker di Vault via dashboard; job `quickdrop-cleanup-transfers` tiap 5 menit.
- Verifikasi RLS, auth worker, scheduler, upload-download fixture dengan hash sama, revoke dan cleanup; semua write tes hanya fixture QuickDrop.

Batch Supabase sudah disetujui: “Project benar; izinkan batch Supabase tersebut.” Tidak ada izin publish Vercel, membuat project cloud baru atau mengubah billing.

## Status remote — 11 Oktober 2026

- Core migration diterapkan, 7 tabel RLS dan 13 RPC diverifikasi: anon/authenticated tidak mendapat akses, service_role mendapat akses.
- `cleanup-transfers` versi 1 ACTIVE, `verify_jwt=false` dengan autentikasi shared secret dalam handler.
- `pg_cron` dan `pg_net` diaktifkan melalui migration kedua.
- Vault `quickdrop_cleanup_url` dan `quickdrop_cleanup_secret` dibuat; nilai secret tidak ditulis dalam source/laporan.
- `.env.local` lengkap dengan server key dari CLI resmi, URL, publishable key dan secret aplikasi acak. Anchor penggunaan mengikuti tanggal pengguna: `2026-10-11T00:00:00+07:00`. `.env.cleanup.local` hanya berisi secret worker; keduanya di-ignore.
- Bucket private `transfers` dibuat melalui SDK resmi: 25.000.000 byte/file dan allowlist MIME. Secret Edge dipasang lewat CLI.
- Job `quickdrop-cleanup-transfers` aktif dengan jadwal `*/5 * * * *`; migration lokal diselaraskan dengan versi remote. Jangan menerapkan ulang migration.
- Eksekusi otomatis `2026-10-11T09:40:00Z` succeeded, respons HTTP 200 dan heartbeat baru terverifikasi.
- Tes fixture live lolos pada `2026-10-11T09:36:59.246Z`: auth worker 401/200, RLS, upload/download hash, idempotency, expiry dan first cleanup sweep. Objek fixture sudah nol; tombstone/reservasi tetap ada sampai lifetime credential + grace berakhir. Final purge setelah `2026-10-11T11:48:50.629584Z` masih perlu diperiksa.
