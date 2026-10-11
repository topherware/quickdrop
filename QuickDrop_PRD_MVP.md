# QuickDrop — PRD dan spesifikasi implementasi MVP

Versi 1.1 • 11 Oktober 2026 • Bahasa produk: Indonesia
Status: PRD implementasi MVP yang diperbarui setelah diskusi infrastruktur dan konfigurasi Supabase MCP. Dokumen ini menggantikan versi 1.0. Vercel + Supabase adalah arsitektur yang dipilih untuk implementasi ini; nama, warna dan batas produk tetap default yang dapat diubah pemilik produk.

## 0. Keputusan terbaru dan instruksi mulai

Gunakan Vercel untuk aplikasi Next.js dan API metadata; Supabase Free untuk PostgreSQL, private Storage, serta Cron/Edge Function cleanup. Tidak memakai VPS, Google Drive, Vercel Blob, Neon atau MinIO pada MVP. Tidak perlu akun untuk pengirim/penerima dan tidak perlu Supabase Auth untuk pengguna aplikasi.

Supabase MCP digunakan oleh Codex saat development untuk inspeksi dan setup. MCP BUKAN koneksi runtime aplikasi: Next.js tetap memakai Supabase SDK dan environment variables. Website harus tetap berjalan ketika Codex ditutup dan sesi MCP tidak aktif.

Kondisi awal dari sesi setup: server bernama `supabase` sudah terlihat pada daftar MCP dengan status enabled dan autentikasi OAuth. Ini bukan bukti query ke project berhasil. Project reference tidak disalin dari screenshot agar tidak salah ketik; baca nilai aktual dari konfigurasi yang tersedia dan cocokkan dengan project QuickDrop yang dikonfirmasi pengguna.

Urutan kerja wajib:
1. Baca PRD lengkap dan aturan repository. Inspeksi folder yang benar; jangan membuat proyek duplikat bila sudah ada kode.
2. Verifikasi MCP dengan operasi baca saja dan tampilkan project reference target, informasi project yang memang tersedia, schema/tabel, bucket, migrations dan tools yang dapat digunakan.
3. Jika nama project tidak dapat diperoleh karena tool account tidak tersedia pada koneksi project-scoped, jangan menyimpulkan gagal. Minta pengguna mencocokkan project reference dengan dashboard. Jangan menebak nama project.
4. Tulis rencana dan SQL migration lokal terlebih dahulu. Ajukan SATU persetujuan awal atas target project dan batch perubahan Supabase. Boleh melanjutkan kode lokal tanpa menunggu persetujuan remote.
5. Setelah disetujui, terapkan batch yang sesuai persetujuan pada project development tersebut, verifikasi hasil, lalu lanjutkan implementasi dan tes. Perubahan tambahan yang destruktif atau memperluas akses memerlukan persetujuan baru.
6. Jangan deploy publik, membeli layanan, upgrade paket, mengubah billing, atau membuat project cloud tambahan tanpa instruksi tersendiri.

### Ringkasan revisi v1.1
- Menetapkan Vercel + Supabase sebagai stack MVP dan memisahkan MCP development dari akses aplikasi.
- Menambahkan verifikasi koneksi, batas otorisasi, fallback setup manual, dan checklist deployment Vercel.
- Menegaskan transfer file langsung ke/dari Supabase agar payload besar tidak melalui Vercel Functions.
- Menetapkan Supabase Cron → Edge Function untuk cleanup setiap 5 menit.
- Memperjelas implementasi idempotency, download grants, penyimpanan secret, dan bukti keberhasilan integrasi.
- Menjaga seluruh flow, batas produk dan acceptance criteria versi sebelumnya.

## 1. Ringkasan produk
QuickDrop adalah web responsif untuk memindahkan foto dan file antardevice tanpa membuat akun. Pengirim memilih file, mengunggahnya, lalu memperoleh kode dan QR. Penerima membuka website yang sama, memasukkan kode atau memindai QR, kemudian mengunduh file. Device tidak harus berada di Wi-Fi yang sama. Setelah seluruh file selesai diunggah dan transfer siap, pengirim boleh menutup website.

Masalah: memindahkan screenshot atau dokumen dari HP ke PC sering memerlukan login layanan lain, mengirim ke diri sendiri, dan mencari file kembali. Produk mempersingkatnya menjadi pilih file → bagikan kode → unduh.

Target awal: mahasiswa dan pengguna pribadi untuk file sehari-hari, dalam pilot terbatas. Bukan layanan arsip atau kanal untuk dokumen rahasia. Untuk penggunaan di perangkat kantor, pengguna tetap mengikuti kebijakan organisasinya.

## 2. Tujuan dan batas cakupan
### Tujuan
- Transfer lintas perangkat dengan mudah tanpa login.
- File asli dipertahankan: tidak dikompresi, diubah formatnya, atau diturunkan resolusinya oleh aplikasi.
- Pengguna memahami status upload, kapan kode berlaku, dan kapan transfer berakhir.
- Biaya MVP dikendalikan melalui batas ukuran, masa berlaku, rate limit, dan cleanup.
- Implementasi backend nyata; bukan demo yang menyimpan file hanya di browser.

### Termasuk MVP (P0)
Upload 1–5 file; input file dan drag-and-drop desktop; progress per file; retry upload; kode akses; QR/link; lookup; daftar file; download per file; countdown; pembatalan oleh pengirim; private storage; cleanup terjadwal; pembatasan penggunaan; UI responsif dan aksesibel; dokumentasi setup serta pengujian alur nyata.

### Tidak termasuk MVP
WebRTC/P2P, transfer teks/link sebagai isi transfer, akun, riwayat permanen, ZIP otomatis, tombol download semua, folder upload, antivirus terkelola, preview isi dokumen, end-to-end encryption, pembayaran, dashboard admin publik, aplikasi native, dan klaim one-time download. QR dan tautan tetap termasuk sebagai cara membuka transfer.

Alasan download per file: menghindari ZIP dan masalah browser memblokir beberapa download otomatis. File kecil boleh diunduh ulang selama akses berlaku, dalam batas penerbitan tautan yang ditentukan.

## 3. Keputusan default
| Area | Default MVP |
|---|---|
| Nama sementara | QuickDrop; jangan anggap domain tersedia |
| UI | Bahasa Indonesia, clean, putih/off-white, aksen oranye, teks gelap |
| Stack | Next.js App Router + TypeScript + Tailwind; Supabase PostgreSQL + Storage |
| Hosting | Vercel untuk Next.js dan API metadata; Hobby hanya bila penggunaan memenuhi ketentuan paket |
| Database dan file | Supabase PostgreSQL + private Storage; tidak memakai database atau storage provider tambahan |
| Setup development | Supabase MCP project-scoped; verifikasi read-only sebelum persetujuan batch write |
| Auth pengguna | Tanpa akun; token capability terpisah untuk pengirim dan penerima |
| Jumlah file | 1–5 per transfer |
| Ukuran per file | Maksimal 25.000.000 byte (25 MB desimal) |
| Total per transfer | Maksimal 50.000.000 byte (50 MB desimal) |
| File kosong | Ditolak untuk MVP |
| Masa upload | 15 menit sejak inisialisasi |
| Masa transfer siap | 30 menit sejak finalisasi berhasil, bukan sejak memilih file |
| Kode | 8 digit acak, ditampilkan 1234 5678; nol di depan tetap valid |
| QR/link | Token acak minimal 128 bit; bukan UUID publik atau path storage |
| Cleanup | Setiap 5 menit; target penghapusan normal ≤10 menit setelah berakhir |
| Signed download URL | Maksimal 60 detik dan tidak melewati sisa masa transfer |
| Pengiriman ulang link unduh | Maksimal 10 penerbitan URL per file per transfer, atomik |
| Kapasitas internal pilot | Cadangan maksimal 750 MB untuk objek dan upload yang masih mungkin terjadi |

Kode 8 digit adalah perubahan sengaja dari contoh 6 digit dalam brainstorming: menambah ruang tebakan tanpa membuat input terlalu panjang. Kode tetap bearer secret: siapa pun yang memilikinya bisa mengambil file. Delapan digit tidak menggantikan rate limit. Semua batas produk disimpan sebagai konfigurasi server; frontend menerima konfigurasi publik yang konsisten.

Jenis file default: jpg/jpeg, png, webp, gif, heic/heif, pdf, txt, csv, docx, xlsx, pptx, zip, mp4, mov. Gunakan allowlist ekstensi dan pasangan MIME yang masuk akal. MIME kosong/octet-stream dapat diterima untuk ekstensi yang diizinkan dengan normalisasi. Jangan klaim ini deteksi malware; nama dan MIME dapat dipalsukan. Tolak html, svg, executable, dan script untuk MVP. ZIP tidak diekstrak. HEIC boleh ditransfer tanpa preview.

## 4. User stories dan alur
### Pengirim
1. Buka `/`, pilih tab Kirim.
2. Pilih atau seret file. Lihat nama, ukuran, total, dan tombol hapus sebelum upload.
3. Validasi langsung menampilkan masalah. Jika batch melanggar batas, jangan upload diam-diam sebagian batch.
4. Tekan Buat kode transfer. Server menginisialisasi transfer dan memesan kapasitas sebelum memberi izin upload.
5. Browser mengirim file langsung ke Storage melalui upload authorization untuk path yang dialokasikan server. Tidak melewatkan payload file melalui API Next.js.
6. Tampilkan progress per file dan total berbobot byte, dengan status menunggu/mengunggah/selesai/gagal. Paralel maksimal dua file.
7. Setelah semua objek terverifikasi server, finalisasi atomik membuat transfer ready dan waktu expired.
8. Tampilkan kode, Copy kode, Copy tautan, QR, daftar file, countdown, dan Akhiri transfer.
9. Pesan: “File siap. Kamu boleh menutup halaman ini. Kode berlaku selama 30 menit.”

Jika upload parsial gagal, file sukses tidak diunggah ulang. Retry harus memeriksa keberadaan objek dan melakukan finalisasi ulang secara idempoten. Jika tab ditutup saat upload, transfer tidak dapat diterima; worker membersihkan objek parsial. Refresh dapat memulihkan transfer siap dalam tab yang sama menggunakan sessionStorage. Resume upload sesudah browser ditutup tidak wajib; minta pengguna memilih file lagi bila diperlukan.

### Penerima melalui kode
1. Buka `/`, pilih Terima.
2. Masukkan kode di satu input; dukung paste dengan spasi, keyboard numerik, dan leading zero.
3. Tekan Cari file. Jangan lookup otomatis setiap mengetik digit.
4. Server memvalidasi kode, status ready, masa berlaku, serta rate limit.
5. Bila valid, server memberi receive token singkat terikat satu transfer. Browser menggunakannya untuk melihat daftar dan meminta link unduh.
6. Tampilkan nama dan ukuran tiap file, total, sisa waktu, tombol Unduh per file.
7. Klik Unduh menerbitkan signed URL baru melalui backend. Buka sebagai attachment. Jangan membuka PDF/HTML sebagai halaman aplikasi.
8. Tampilkan “Unduhan dimulai”, bukan “File berhasil tersimpan”, karena browser tidak memberi kepastian file tersimpan di perangkat.

### Penerima melalui QR/link
QR berisi `${APP_ORIGIN}/receive#token=<random-token>`. Fragment dibaca client, dihapus dari address bar menggunakan replaceState setelah dibaca, lalu ditukar melalui POST menjadi receive token. Jangan memasukkan token dalam query string, telemetry, atau log. QR dibuat lokal, bukan layanan QR eksternal. QR memerlukan kamera/aplikasi pemindai perangkat; aplikasi tidak memerlukan fitur scan kamera internal pada MVP.

### Akhiri transfer
Pengirim menekan Akhiri transfer → dialog konfirmasi sederhana → server memvalidasi owner token → revoke secara atomik. Lookup dan penerbitan URL baru langsung ditolak, kemudian cleanup Storage dipicu. Tautan yang sudah diterbitkan mungkin masih bekerja sebentar; salinan yang sudah diunduh tidak dapat ditarik kembali. UI menjelaskan ini secara singkat.

## 5. Halaman dan UI
| Halaman/state | Isi wajib |
|---|---|
| Home / Kirim kosong | Brand, tagline “Pindahkan file antarperangkat, tanpa login.”, tab Kirim/Terima, dropzone, batas ukuran |
| File dipilih | Daftar file, total, hapus file, tombol upload |
| Mengunggah | Progress nyata, byte/percentage, retry dan batal |
| Transfer siap | Kode besar, copy feedback, QR, salin tautan, countdown, akhiri |
| Terima | Input kode tunggal, button, instruksi singkat |
| Daftar diterima | File, ukuran, sisa waktu, download per file |
| Invalid/expired | “Kode tidak valid atau transfer sudah berakhir.” |
| Rate limited | “Terlalu banyak percobaan. Coba lagi dalam … detik.” |
| Kapasitas penuh | “Penyimpanan sementara sedang penuh. Coba lagi nanti.” |
| Offline/provider error | Pesan jelas dan tombol coba lagi; jangan tampilkan stack trace |

Desain mobile-first mulai 360px, tanpa horizontal scroll. Target sentuh ≥44px, focus ring, label input eksplisit, kontras WCAG AA, navigasi keyboard, aria-live untuk status penting tanpa mengumumkan countdown setiap detik. Kode menggunakan tabular numerals. Animasi minimal dan respect reduced motion. Jangan memakai progress palsu. Clipboard API harus punya fallback manual select/copy. Countdown berdasarkan waktu server, bukan jam lokal sebagai otoritas.

Thumbnail hanya lokal untuk gambar terpilih bila aman dan ringan; gunakan ikon file untuk daftar penerima agar tidak menambah download sebelum pengguna memilih Unduh. Jangan mengirim nama file ke analytics. Hindari klaim “100% aman”, “anonymous total”, “terenkripsi end-to-end”, atau “pasti terhapus tepat pada detik ke-30 menit”.

## 6. Arsitektur
- Browser: UI, validasi awal, upload langsung, pembacaan QR link, download.
- Next.js backend: validasi otoritatif, generate token/kode, rate limiting, quota reservation, finalisasi, lookup, otorisasi, signed download URL.
- Supabase Database: metadata dan koordinasi transaksi.
- Supabase private Storage bucket `transfers`: file asli.
- Supabase Cron → Supabase Edge Function `cleanup-transfers` terautentikasi setiap 5 menit. Siapkan SQL schedule dan Vault/secret. Tidak menggunakan Vercel Hobby Cron untuk frekuensi ini.

### Jalur data yang wajib
- Upload: browser → Supabase Storage secara langsung, setelah otorisasi dari API Vercel.
- Metadata/kode: browser → API Next.js di Vercel → Supabase Database.
- Download: browser → signed URL Supabase Storage secara langsung, setelah validasi kode/sesi pada API Vercel.
- Cleanup: Supabase Cron → Edge Function → Storage API remove → pembaruan/hapus metadata.

Vercel Functions memiliki batas payload; jangan menerima multipart file 25 MB di route handler atau Server Action. API aplikasi cukup menerima JSON metadata kecil. Jangan menulis file pengguna ke `/public`, filesystem deployment atau `/tmp` sebagai storage persisten, dan jangan menggunakan SQLite lokal di Vercel. Hindari in-memory rate limit dan background `setInterval` karena instance serverless bukan worker permanen. Supabase Cron dipilih karena Vercel Hobby Cron dibatasi sekali sehari pada dokumentasi saat penyusunan; verifikasi ulang saat deployment.

Storage dan database tidak memiliki satu transaksi lintas layanan. Gunakan state machine, retry idempoten, dan rekonsiliasi. Jangan menyimpan file base64/blob di tabel database. Jangan menyimpan URL unduh permanen pada metadata.

Pilih rilis stabil library yang kompatibel saat implementasi, pin lockfile, dan tulis versi aktual di README. Verifikasi API resmi sebelum memakai contoh kode; PRD ini spesifikasi perilaku, bukan janji signature SDK tertentu.

## 7. Model data konseptual
### transfers
- id UUID primary key; bukan credential.
- status enum: uploading, ready, revoked, deleting, cleanup_failed.
- code_digest unique nullable: HMAC kode memakai server secret; tidak perlu menyimpan kode plaintext.
- share_token_digest: hash token berentropi tinggi, unique.
- owner_token_digest: hash token pengirim, tidak pernah dikirim ke penerima.
- created_at, upload_deadline, ready_at, expires_at: timestamptz UTC dari server.
- reserved_bytes bigint: reservasi terburuk untuk jumlah slot × batas bucket per objek sampai upload credentials kadaluarsa; lihat bagian upload.
- actual_total_bytes bigint nullable; file_count int.
- upload_credentials_valid_until timestamptz; purge_after timestamptz.
- cleanup_attempts, cleanup_next_attempt_at, last_cleanup_error_code, cleanup_lease_until.
- idempotency_key_digest unique untuk inisialisasi.

### transfer_files
- id UUID, transfer_id FK.
- object_path unique: `transferUUID/fileUUID` tanpa nama asli.
- original_name yang disanitasi, declared_mime, declared_size_bytes.
- actual_size_bytes, upload_status, created_at.
- download_grants_count integer default 0, max 10.
- uploaded_at, deleted_at nullable.

### receive_sessions
Token digest primary key, transfer_id FK, created_at, expires_at ≤ transfer expires_at. Token tidak mengandung owner permissions. Hapus ketika transfer selesai dibersihkan.

### idempotency_records dan download_grants
- `idempotency_records`: scope, key_digest, request_digest, transfer_id, status, encrypted_response, created_at, expires_at; unique(scope, key_digest). Key yang dipakai ulang dengan body berbeda harus ditolak 409. Respons init berisi owner secret hanya dapat direplay menggunakan key acak berentropi tinggi yang sama; jangan memakai key berurutan.
- `download_grants`: id UUID, transfer_file_id, receive_session_digest, idempotency_key_digest, status pending/issued/failed, encrypted_url nullable, valid_until, lease_until, created_at. Unique pada file + receive session + idempotency key. URL adalah secret; hanya disimpan terenkripsi bila perlu replay.
- Hitung issued + pending yang belum direkonsiliasi untuk penegakan batas 10; jangan hanya menghitung respons yang sudah berhasil dikirim ke browser.
- Gunakan transaksi/row lock untuk reservasi grant. Jangan menahan transaksi database selama network request ke Storage.
- Jika signing berhasil tetapi commit tidak dapat dipastikan, jangan asal mengurangi counter: URL mungkin sudah valid. Rekonsiliasi pending lease secara konservatif sebelum membebaskan slot.
- Record idempotency/grant ikut cleanup. Pisahkan masa retensi replay dari masa aktif akses transfer.

### rate_limit_buckets dan usage_guard
Counter atomik per scope/window dan identifier hash; expiry untuk pembersihan. usage_guard menyimpan reservation bytes dan estimasi download bytes periode berjalan. Jangan mengandalkan Map in-memory pada deployment serverless.

Indexes: transfer status + expiry/upload_deadline, cleanup_next_attempt_at, transfer_files.transfer_id, receive session expiry. Constraints: ukuran positif, jumlah 1–5, total 50 MB, objek ≤25 MB; unique idempotency dan code digest. Terapkan invariants lewat transaksi/RPC dan validasi backend. RLS aktif dan tidak ada anonymous read/list/write untuk tabel aplikasi maupun bucket. Hanya backend berwenang mengakses; credentials upload scoped menjadi pengecualian sempit untuk path tertentu. RPC privileged tidak boleh dapat dipanggil anon/public; tetapkan grants dan search_path secara eksplisit.

## 8. Upload authorization dan konsistensi
1. POST init menerima metadata saja; maksimal body 16 KB.
2. Dalam transaksi, validasi limit, rate limit, circuit breaker, lalu reserve kapasitas konservatif. Untuk n file, reserve n ×25 MB pada awal karena signed upload URL belum tentu membatasi byte sesuai ukuran deklarasi per path.
3. Alokasikan UUID objek; jangan menerima bucket atau path dari client.
4. Buat signed upload URL untuk setiap path dengan upsert=false. Storage bucket limit wajib 25 MB. Browser tidak menerima service role key.
5. Pakai upload langsung dengan progress (SDK/TUS atau XHR sesuai dukungan resmi). Standard upload dapat dipakai untuk file kecil; resumable upload disarankan untuk file >6 MB. Jangan menjanjikan automatic resume antar-browser.
6. Completion server memeriksa seluruh objek di Storage lewat API resmi, bukan percaya client. Verifikasi byte aktual sesuai deklarasi, jumlah file, total dan path. Jika tidak sesuai, blokir finalisasi dan cleanup.
7. Baru setelah seluruh objek valid, transaksi menetapkan ready, ready_at, expires_at, dan kode unik. Kode dibuat dengan CSPRNG, retry konflik unique, leading zero dipertahankan. Jangan pakai Math.random.
8. Idempotency-Key untuk init dan complete mencegah transfer ganda; retry complete mengembalikan hasil yang sama selama transfer masih aktif. Default implementasi: key acak minimal 128 bit dari browser; server menyimpan request digest dan response envelope dengan authenticated encryption (misalnya AES-256-GCM, nonce unik per enkripsi) memakai TOKEN_ENCRYPTION_KEY server-only. Replay harus memvalidasi scope, request digest, status dan expiry; complete tetap memerlukan owner token. Simpan envelope finalisasi berisi kode/share token agar response hilang dapat dipulihkan tanpa mengganti kode. Setelah revoked/expired, jangan replay upload credential atau akses siap. Jangan membuat plaintext log secret demi retry.

Perhatian penting: dokumentasi signed upload URL Supabase menyatakan berlaku 2 jam. Upload deadline aplikasi 15 menit tidak otomatis membatalkan URL tersebut. Catat expiry credential aktual. Pertahankan tombstone/path dan reservation hingga credential terlama berakhir ditambah grace 10 menit. Sweep ulang untuk menghapus file yang diunggah terlambat atau dibuat kembali setelah deletion. Jangan melepas seluruh reservasi pada cleanup pertama. Sesudah credential habis, verifikasi objek hilang, kemudian hard-delete metadata dan release reservation. Jangan menganggap upsert=false menjadikan URL sekali pakai untuk selamanya setelah objek dihapus. Ini membuat MVP lebih konservatif dalam kapasitas, namun tidak meninggalkan orphan karena retry terlambat.

## 9. API contract
Semua response sensitif `Cache-Control: no-store`. Format error `{error:{code,message,retryAfterSeconds?},requestId}`. Validasi server dengan schema library. Token dikirim di Authorization header, bukan URL/log.

| Endpoint | Input/authorization | Hasil |
|---|---|---|
| GET /api/config | Public | Batas publik, serverTime; tanpa secret |
| POST /api/transfers | Idempotency-Key; files metadata | 201: transferId, ownerToken, upload targets, uploadDeadline |
| GET /api/transfers/:id/status | ownerToken | Status slot, state dan expiry; bukan public lookup |
| POST /api/transfers/:id/complete | ownerToken, Idempotency-Key | 200: code, share link token, expiresAt, serverTime setelah validasi |
| POST /api/transfers/lookup | code string | 200: receiveToken, metadata, expiresAt; invalid generic 404 |
| POST /api/transfers/exchange | share token | Sama seperti lookup |
| POST /api/files/:fileId/download | receiveToken, Idempotency-Key | 200: downloadUrl, validUntil; atomik grant count |
| DELETE /api/transfers/:id | ownerToken | 202 revoked; deletion async; panggilan ulang aman |
| POST cleanup worker | Dedicated server secret | Ringkasan count; tidak ada nama/path/token |

Lookup harus mengembalikan pesan yang sama untuk kode tidak ada, expired, revoked, atau belum ready. Download menolak file dari transfer lain meskipun file UUID valid. Jangan menerbitkan URL bila sisa masa berlaku <2 detik; TTL floor(min(60, remainingSeconds-1)). Minta ulang URL jika expired ketika user mulai download dan transfer masih aktif.

Batas “10” menghitung izin URL yang diterbitkan, bukan jumlah download fisik. Signed URL dapat digunakan ulang selama berlaku. Satu idempotency key tidak memakan slot lagi selama grant tersimpan; grant lama yang habis dikembalikan sebagai expired dan UI membuat request baru. Jika signing gagal, pastikan counter/reservation dirollback atau dipulihkan lewat mekanisme yang terdokumentasi, tanpa race condition.

HTTP: 400 input, 401 token invalid, 404 unavailable, 409 state conflict, 413 limit byte metadata/deklarasi, 415 unsupported type, 429 rate limit, 503 kapasitas/provider unavailable. File payload di Storage dapat memiliki status provider sendiri; map ke pesan ramah.

## 10. Keamanan, privasi, dan kontrol biaya
- HTTPS produksi; origin check pada mutation, CORS allowlist origin aplikasi, trusted proxy IP configuration.
- Secret server-only: service role, HMAC/encryption keys, cleanup secret. Tidak pernah NEXT_PUBLIC. Publishable key bukan service role.
- Token owner/share/receive acak minimal 128 bit, lebih baik 256 bit. Owner token hanya disimpan sessionStorage dan memory; jangan di QR atau receive payload.
- HMAC kode 8 digit mengurangi risiko brute-force offline dari dump database tanpa secret; rate limit tetap wajib online.
- Default rate limit: init 5 per IP/10 menit; lookup/exchange 10 per IP/10 menit; download 30 per IP/10 menit plus limit grant/file. Semua percobaan lookup dihitung. IP disimpan sebagai keyed digest dan dipurge ≤24 jam; jangan klaim digest membuat data sepenuhnya anonim.
- Pembatasan juga global: alarm saat gagal lookup melonjak, toggle menghentikan init atau lookup ketika diserang. IP kantor/NAT bisa terkena limit bersama; jadikan parameter configurable dan uji pilot.
- Kapasitas reservation guard 750 MB, dihitung atomik untuk concurrent uploads. Jika penuh, tolak sebelum upload credentials diterbitkan.
- Estimasi egress: tambah actual file bytes setiap penerbitan grant; trigger penghentian upload baru pada 4 GB estimasi per siklus yang dikonfigurasi. Jangan menyebut ini meter billing akurat: link reuse, retry dan API lain dapat membuat egress nyata lebih besar. Dashboard provider adalah acuan; alert manual selama pilot.
- Tidak ada analytic pihak ketiga yang membaca kode, QR, token, nama file atau URL download. Log hanya requestId, stage, status, duration dan error code tersanitasi.
- Sanitize nama: buang separator path, control chars, batasi panjang, escape output React dan content-disposition. Jangan render HTML dari filename.
- File disajikan sebagai attachment; verifikasi perilaku download lintas origin di browser, jangan hanya mengandalkan atribut download HTML.
- Tidak ada malware scanner P0: UI jangan mengklaim file aman. Jangan mengeksekusi/mengekstrak file.
- Tidak ada end-to-end encryption P0; service operator secara teknis dapat mengakses objek. Aplikasi hanya menyimpan sementara, bukan menjamin secure erasure semua lapisan infrastruktur.

## 11. Expiry dan cleanup
Expiry logis selalu diperiksa server pada lookup, exchange, status dan download authorization. Jangan mengandalkan timer browser atau scheduler untuk menutup akses aplikasi.

Worker tiap 5 menit:
1. Claim batch maksimal 50 transfer dengan lease/lock agar worker paralel aman.
2. Pilih upload yang lewat deadline, ready expired, revoked, cleanup_failed yang waktunya retry.
3. Tandai deleting/cleanup_failed sehingga akses selalu ditolak.
4. Hapus objek melalui Supabase Storage API remove. Jangan DELETE langsung dari storage.objects: itu tidak menjamin byte objek terhapus.
5. Already missing diperlakukan berhasil; error nyata disimpan dan dicoba ulang, tidak diabaikan.
6. Pertahankan metadata path/tombstone sampai seluruh upload credentials habis + grace; sweep ulang objek selama jendela itu.
7. Setelah final sweep berhasil, hapus file metadata, sesi/grant, transfer metadata dalam transaksi; release reservation.
8. Retry backoff, bounded batch dan timeout. Worker yang crash melepas lease setelah timeout; cleanup idempoten.
9. Bersihkan rate-limit/grant records expired dan log cron sesuai retensi pendek. Catat cleanup heartbeat dan oldest expired object age.

Target normal file dihapus ≤10 menit setelah expiry; saat provider gagal bisa lebih lama, jangan janjikan batas absolut. Metadata tombstone dapat bertahan sekitar 2 jam lebih karena umur signed upload credential, kemudian ikut dihapus. Jika ingin penghapusan metadata 30 menit persis, upload authorization perlu didesain ulang dengan izin lebih pendek yang bisa ditegakkan.

Signed download URLs adalah bearer links terpisah. TTL singkat tidak menjamin penghentian byte transfer yang sudah berjalan. Cache provider juga perlu diverifikasi: set object cache control paling rendah yang didukung dan uji expiry; jangan menjanjikan hard revocation instan berdasarkan JWT expiry saja. Dokumentasi CDN menyebut cache dapat memengaruhi akses. Kalau persyaratan berubah menjadi zero-access tepat pada expiry, perlu desain authenticated download gateway dan evaluasi biaya/streaming; bukan asumsi MVP.

## 12. Sasaran kualitas dan pengukuran
Target pilot, bukan SLA: 10 pengguna, sedikitnya 20 percobaan lintas perangkat; ≥90% transfer valid selesai tanpa bantuan; pengguna memahami kode dalam ≤10 detik sesudah upload. Jangan memasukkan waktu jaringan upload ke target latency API.

Ukur manual atau agregat anonim: init count, ready count, failed upload count, valid lookup count, download grant count, error stage, cleanup lag, reserved bytes. Download grant bukan bukti download selesai. API metadata target p95 <2 detik dalam pilot, tergantung cold start/provider, diverifikasi setelah deployment.

Tidak perlu akun analytics vendor untuk MVP. README menjelaskan cara melihat pemakaian nyata Storage dan egress pada dashboard Supabase.

## 13. Acceptance criteria dan pengujian wajib
| ID | Skenario | Hasil yang harus dibuktikan |
|---|---|---|
| AC01 | HP upload JPG → PC input kode | File dapat diunduh; hash SHA-256 sebelum/sesudah sama |
| AC02 | PC upload PDF → HP QR | Transfer yang benar tampil, attachment dapat disimpan |
| AC03 | 5 file total ≤50 MB | Semua terverifikasi sebelum kode ready; download individual berhasil |
| AC04 | >25 MB/file, >50 MB total, 6 file, 0 byte | Ditolak frontend dan backend; tidak menyiapkan credential tanpa reserve |
| AC05 | Ukuran aktual berbeda deklarasi | Complete ditolak, objek dibersihkan, tidak ready |
| AC06 | Kode 0012 3456 dipaste | Leading zero dipertahankan; normalisasi konsisten |
| AC07 | Kode tidak valid/expired/revoked | Error generik sama, tanpa metadata bocor |
| AC08 | Dua complete/init retry bersamaan | Satu transfer/logical result; tidak membuat slot/reservasi ganda |
| AC09 | Collision kode dipaksakan dalam test | Retry unique aman, tidak menimpa transfer lain |
| AC10 | Upload jaringan putus | Retry file gagal; file sukses tidak diduplikasi; deadline tetap berlaku |
| AC11 | Sender close sebelum/ sesudah ready | Sebelum: cleanup parsial; sesudah: penerima tetap berhasil |
| AC12 | Credential late upload setelah expiry | Objek tidak menjadi ready; sweep ulang menghapus; reservation masih berlaku |
| AC13 | Storage delete gagal | Referensi dipertahankan dan retry; tidak hilang metadata sebelum cleanup selesai |
| AC14 | Anonymous list/read/write database/bucket | Ditolak dengan publishable key langsung, bukan hanya lewat UI |
| AC15 | Owner endpoint memakai receive token | Ditolak; file lintas transfer ditolak |
| AC16 | Rate limit dan concurrent capacity | 429/503 sesuai; counter atomik bekerja lintas instance |
| AC17 | 11 request grant file, termasuk paralel | Maksimal 10 grant unik; idempotency tidak double count |
| AC18 | Signed URL expiry/cache | Uji URL lama dan perilaku cache nyata; dokumentasikan residual access dan jangan klaim hard cutoff |
| AC19 | Cleanup dua worker/crash | Lease dan retry aman; tidak double-release kapasitas |
| AC20 | Filename berisi HTML/path/Unicode | Tidak XSS/path traversal, nama unduh wajar |
| AC21 | Tanpa Supabase env | Setup error jelas, tidak berpura-pura upload berhasil |
| AC22 | Chrome desktop/Android, Safari iOS | Upload, QR link, clipboard fallback, attachment dan keyboard berhasil |

Gunakan unit test untuk validator, normalisasi, state transitions; integration test untuk RLS, transaksi, grant dan cleanup; Playwright untuk alur browser. Uji nyata minimal dua perangkat dan jaringan berbeda. Bila perangkat tidak tersedia, nyatakan belum diuji. Mocks bukan bukti integrasi Supabase selesai. Test expiry dengan clock injection/test fixtures, tidak perlu menunggu 30 menit. Jangan mempersingkat TTL produksi secara diam-diam.

## 14. Struktur proyek yang disarankan
- app/page.tsx — tabs Kirim/Terima.
- app/receive/page.tsx — pertukaran token fragment.
- app/api/... — route handlers sesuai contract.
- components/send, receive, ui — UI terpisah dari backend logic.
- lib/server/supabase.ts, transfers.ts, tokens.ts, limits.ts, rate-limit.ts, storage.ts — server-only.
- lib/shared/validation.ts, types.ts, config.ts — tipe dan schema aman untuk client.
- supabase/migrations — schema, indexes, grants, RPC, RLS, bucket dan cron setup.
- supabase/functions/cleanup-transfers — worker jika memakai Edge Functions.
- tests/unit, tests/integration, tests/e2e.
- README.md, .env.example, package lockfile.

Variabel wajib ditulis pada `.env.example` dengan placeholder saja:

| Nama | Scope dan fungsi |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | URL project; client dan server |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable key, atau anon key legacy yang kompatibel; hanya bila diperlukan SDK client |
| SUPABASE_SERVICE_ROLE_KEY | Server Next.js saja; jangan di client bundle; jika memakai secret key baru gunakan nama server-only dan dokumentasikan adapter |
| APP_ORIGIN | Origin deployment resmi atau localhost; allowlist eksplisit untuk preview yang disetujui |
| CODE_HMAC_SECRET | Server-only; keyed digest kode |
| RATE_LIMIT_HMAC_SECRET | Server-only; keyed digest identifier pembatasan |
| TOKEN_ENCRYPTION_KEY | Server-only; key enkripsi response envelope; dokumentasikan format dan panjang |
| CLEANUP_SECRET | Shared secret scheduler/Edge Function saja; jangan dikirim ke browser |
| USAGE_PERIOD_START | Anchor periode estimasi egress, bukan asumsi otomatis tanggal 1 |

Secrets aplikasi disimpan pada `.env.local` yang di-ignore git dan pada Vercel Environment Variables untuk environment yang benar. Secrets worker disimpan sebagai Supabase Function secrets; scheduler mengambil secret dari Vault atau mekanisme resmi yang setara. Jangan hardcode secret di SQL migration, cron URL, README, screenshot atau chat. Jangan membaca seluruh env/auth file ke output terminal. MCP OAuth credentials tidak boleh diekspor menjadi credential aplikasi. Setelah perubahan environment Vercel, deployment baru perlu memakai konfigurasi tersebut.

### 14A. Runbook Supabase MCP untuk Codex
1. Gunakan koneksi `supabase` yang ada; jangan install ulang plugin atau membuat server MCP duplikat tanpa kebutuhan nyata.
2. Cek tools yang benar-benar tersedia. Dokumentasi saat revisi menyebut feature group Storage tidak aktif secara default, dengan tool listing bucket dan konfigurasi Storage; jangan mengarang tool `create_bucket` atau menjanjikan semua operasi Storage didukung MCP. Jika group belum aktif, jelaskan ke pengguna sebelum mengubah konfigurasi scope/features. Listing metadata bucket lewat query baca yang memang diizinkan dapat menjadi alternatif inspeksi, bukan izin menulis tabel internal Storage.
3. Lakukan query baca untuk membuktikan koneksi dan scope project. `enabled` bukan health check; label OAuth sendiri bukan bukti semua izin project tersedia.
4. Jika autentikasi dibutuhkan, arahkan pengguna login melalui browser. Pada CLI yang mendukung, `codex mcp login supabase` dapat digunakan. Jangan meminta pengguna menempel OAuth token atau service-role key ke chat.
5. Jika MCP read-only atau akses ditolak, jangan mengubah mode/bypass batas akses. Minta arahan untuk menjalankan batch yang membutuhkan write. Tetap lanjutkan pekerjaan lokal yang tidak membutuhkan izin tersebut.
6. Inventarisasi migrations/schema/bucket sebelum perubahan. Simpan semua perubahan schema sebagai file migration di repository, kemudian jalankan melalui tool migration jika tersedia, bukan query ad hoc tanpa jejak.
7. Buat private bucket `transfers` dengan batas 25.000.000 byte melalui kemampuan resmi yang tersedia: Storage API/SDK atau dashboard. Bila MCP tidak mendukungnya, siapkan script setup server-side untuk credentials yang sudah dikonfigurasi secara sah, atau langkah manual singkat. Jangan menulis langsung ke tabel internal Storage sebagai jalan pintas.
8. Konfigurasi allowed MIME bucket harus kompatibel dengan normalisasi file yang diizinkan aplikasi. Jangan menolak file Office/HEIC yang MIME browser-nya berbeda secara diam-diam; tes format tersebut dan dokumentasikan mapping. Allowlist bukan pemeriksaan malware.
9. Jangan mengubah private bucket yang sudah ada menjadi public atau mengganti seluruh policies/schema. Bila nama bucket bertabrakan dengan data lain, berhenti dan minta pilihan pengguna.
10. Deploy worker Supabase dan jadwalkan cron hanya sebagai bagian batch setup yang disetujui. Jika tool functions/Vault/cron tidak tersedia, berikan langkah manual spesifik tanpa menyebut setup selesai.
11. Buat job bernama stabil, misalnya `quickdrop-cleanup-transfers`; inspeksi job yang sudah ada sebelum create/update agar tidak ada duplikat.
12. Verifikasi hasil: bucket private, batas ukuran, RLS dan grants, migration history, worker auth, schedule aktif, serta satu eksekusi cleanup dengan fixture milik test. Jangan memakai file pribadi sebagai fixture dan jangan menghapus data di luar fixture/transfer QuickDrop yang berwenang.

Worker harus menolak request tanpa credential yang sah sebelum mengakses Storage. Verifikasi kompatibilitas gateway Edge Functions dengan metode auth yang dipilih. Jika `verify_jwt=false` diperlukan untuk shared-secret handler, jelaskan alasannya dan pastikan handler tetap melakukan verifikasi secret secara constant-time; itu bukan izin endpoint cleanup publik tanpa auth. Secret untuk pemanggilan worker dipisahkan dari service-role key runtime worker.

### 14B. Checklist Vercel dan operasi pilot
- Gunakan satu repository dan satu project Vercel target; jangan buat duplikat. PRD ini hanya memerintahkan persiapan deployment, bukan publish otomatis.
- Pastikan ketentuan Hobby cocok untuk pilot pribadi/nonkomersial. Jangan menjanjikan semua penggunaan bisnis dapat memakai paket gratis; verifikasi sebelum launch.
- API menggunakan Node runtime bila dependency crypto/server memerlukannya; pilih region yang dekat dengan Supabase bila paket mendukung.
- Preview tidak boleh tanpa sengaja melakukan write ke data production. Awali dengan satu project Supabase development khusus QuickDrop; jangan otomatis membuat project kedua yang memakai kuota. Tambahkan environment terpisah sebelum produksi bila diperlukan dan disetujui.
- Atur APP_ORIGIN dan environment variables, jalankan build, verifikasi endpoint metadata, lalu lakukan deployment setelah instruksi pemilik.
- Setelah deploy, uji upload langsung melalui Network panel dan download langsung dari Supabase, tanpa file payload melalui Vercel.
- Supabase Free dapat mengalami keterbatasan kuota/availability; tampilkan service-unavailable dengan retry. Jangan membuat traffic palsu untuk menghindari ketentuan paket.
- Monitor Storage, egress, function usage, error rate dan cleanup heartbeat. Alarm cleanup tidak berjalan >10 menit; investigasi backlog sebelum mengaktifkan upload baru kembali.
- Export/versikan migration dan konfigurasi di repo. Jangan berasumsi backup otomatis database maupun file tersedia pada paket gratis. File transfer sementara tidak dicadangkan oleh aplikasi; beritahu pengguna ini bukan tempat penyimpanan permanen.
- Bukti akhir mencakup environment yang diuji, timestamp, hasil build/test, grant/download, dan cleanup fixture. Jangan mencantumkan secret atau signed URL di laporan.

## 15. Tahapan implementasi Codex
1. Inspeksi repository/AGENTS.md dan dependency; verifikasi MCP project-scoped secara read-only sesuai bagian 0 dan 14A; dokumentasikan asumsi, jangan overwrite proyek lain.
2. Siapkan migrations, RLS, private bucket setup, state transitions dan reservation transaction secara lokal. Minta persetujuan target/batch Supabase sebelum apply; setelah disetujui gunakan koneksi yang sudah diverifikasi.
3. Implement init/direct upload/finalize; buktikan satu file nyata bekerja.
4. Implement lookup, receive tokens, signed download dan ownership controls.
5. Tambah QR, multi-file, copy, progress, retry dan responsive states.
6. Implement worker, scheduler, late-upload sweep, quota/rate limit.
7. Jalankan pengujian bermakna, build/typecheck/lint sesuai tools repository; perbaiki kegagalan.
8. Lengkapi README setup lokal, Supabase manual steps, scheduler secrets, deployment, test evidence, batas dan troubleshooting.

Deliverables wajib: source aplikasi; SQL migrations runnable; worker dan scheduling setup; .env.example; README; test suite utama; ringkasan apa yang sudah diuji dan belum. Jangan menandai complete jika cleanup hanya fungsi yang tidak pernah dijadwalkan. Jika kredensial belum tersedia, lanjutkan semua pekerjaan lokal, kemudian sebutkan langkah integrasi yang masih dibutuhkan. Tidak membuat akun, membeli paket/domain, atau mempublish otomatis sebagai bagian PRD ini.

## 16. Definition of Done
MVP selesai jika AC inti upload/receive/download/expiry/cleanup/auth/rate limit terbukti, file hash sesuai, build berhasil, UI mobile berfungsi, secrets tidak di client bundle, setup reproducible, dan scheduler berjalan di environment integrasi. Klaim status harus memisahkan “selesai secara kode” dan “terverifikasi dengan backend live”. Produk baru layak pilot publik setelah kontrol penyalahgunaan dan penggunaan kuota diuji.

## 17. Prompt untuk ditempel ke Codex

Salin teks berikut ke Codex setelah menaruh file PRD ini di root proyek:

```text
Baca seluruh QuickDrop_PRD_MVP.md versi 1.1 sebagai spesifikasi utama. Bangun MVP QuickDrop end-to-end menggunakan Next.js App Router, TypeScript, Tailwind, Vercel sebagai target hosting, serta Supabase PostgreSQL dan private Storage. Jangan mengganti stack ke VPS, Google Drive atau Vercel Blob.

Mulai dengan membaca AGENTS.md dan menginspeksi kode yang sudah ada. Pertahankan perubahan saya. Gunakan Supabase MCP bernama supabase yang sudah dikonfigurasi, tetapi buktikan aksesnya dengan operasi baca dan cocokkan project reference terlebih dahulu. Jangan menganggap status enabled/OAuth berarti semua operasi berhasil. Jangan menginstal ulang plugin atau membuat koneksi duplikat.

Buat rencana implementasi singkat dan file migration lokal. Sebelum write pertama ke Supabase, tampilkan target project serta batch perubahan database, private bucket, Edge Function dan Cron yang akan dilakukan, lalu minta persetujuan saya sekali untuk batch tersebut. Sambil menunggu, lanjutkan pekerjaan lokal yang aman. Jangan menghapus atau menimpa data/policy yang tidak terkait. Jika tool bucket tidak tersedia, gunakan setup script resmi dengan kredensial yang memang sudah tersedia atau jelaskan langkah manual; jangan mengarang kemampuan MCP.

Implementasikan upload langsung browser ke Supabase, finalisasi terverifikasi, kode 8 digit + QR, penerimaan tanpa login, download langsung lewat signed URL, revoke, rate limit atomik dan quota reservation. Ikuti detail idempotency, concurrency dan late-upload cleanup di PRD. Gunakan Supabase Cron dan Edge Function untuk cleanup setiap 5 menit, bukan Vercel Hobby Cron. Jangan menaruh payload file besar di route Vercel atau membuat bucket public.

MCP hanya untuk development. Aplikasi harus berjalan mandiri dengan environment variables yang aman. Jangan menampilkan secret, menyalin OAuth token, atau menaruh service-role key di frontend/git. Jika env belum tersedia, buat .env.example berisi placeholder, lanjutkan pekerjaan lokal dan laporkan setup yang tersisa.

Kerjakan bertahap sampai kode, pengujian, dan README siap. Jalankan build, typecheck, lint dan tes yang relevan; pisahkan hasil mock dari integrasi live. Bukti live minimal mencakup upload-download berkas dengan hash sama dan cleanup fixture. Jangan mengklaim perangkat atau akses cloud sudah diuji bila belum. Jangan membeli layanan, upgrade paket atau publish tanpa instruksi lanjutan.

Akhiri dengan ringkasan perubahan, hasil tes, langkah menjalankan lokal, status setup Supabase, checklist deploy Vercel dan blocker yang masih perlu tindakan saya.
```

## 18. Pilihan opsional untuk revisi setelah draft
Tidak perlu dijawab agar Codex bisa mulai: (1) nama final QuickDrop atau nama lain; (2) pertahankan UI Indonesia/oranye atau ganti; (3) apakah MP4/MOV/ZIP diperlukan sejak pilot; (4) apakah pilot untuk diri sendiri/teman atau langsung publik. Jika publik luas, tinjau rate limits, CAPTCHA/abuse mitigation dan budget sebelum peluncuran. P2P merupakan fase berikutnya dengan signaling serta kemungkinan relay TURN; jangan menganggap semua transfer P2P pasti tanpa biaya bandwidth server.

## 19. Dasar teknis yang diverifikasi dan sumber
Dicek 10 Oktober 2026; batas vendor dapat berubah. Batas produk di PRD adalah pilihan desain, bukan seluruh kuota provider.
- Supabase Free membatasi maksimum file 50 MB; produk sengaja membatasi 25 MB. https://supabase.com/docs/guides/storage/uploads/file-limits
- Storage Free 1 GB; periksa scope billing organisasi saat setup. https://supabase.com/docs/guides/platform/billing-on-supabase
- Cached dan uncached egress memiliki kuota terpisah; Free 5 GB masing-masing. Jangan menjumlahkannya menjadi 10 GB uncached. https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Signed upload URLs didokumentasikan berlaku 2 jam; tidak sama dengan umur transfer produk. https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
- Resumable uploads dan signed upload token: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- Standard uploads direkomendasikan untuk file kecil ≤6 MB: https://supabase.com/docs/guides/storage/uploads/standard-uploads
- Delete objek harus melalui Storage API, bukan SQL metadata: https://supabase.com/docs/guides/storage/management/delete-objects
- Private bucket dan signed URLs: https://supabase.com/docs/guides/storage/serving/downloads
- TTL signed URL: https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl
- Cache dapat memengaruhi akses signed URL: https://supabase.com/docs/guides/storage/cdn/smart-cdn
- Supabase Cron dapat menjadwalkan SQL/function/HTTP; setup nyata tetap diperlukan: https://supabase.com/docs/guides/cron

Tambahan sumber untuk revisi 11 Oktober 2026:
- Supabase MCP: scope project, feature groups dan autentikasi; daftar tool harus diperiksa di sesi nyata: https://supabase.com/docs/guides/ai-tools/mcp
- Dokumentasi Codex MCP, OAuth dan konfigurasi: https://developers.openai.com/codex/mcp
- Batas Vercel Functions, termasuk payload: https://vercel.com/docs/functions/limitations
- Batas frekuensi Vercel Cron pada Hobby: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Ketentuan paket Hobby harus dicek sebelum penggunaan komersial: https://vercel.com/docs/plans/hobby
