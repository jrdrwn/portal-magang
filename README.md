# Portal Magang

Next.js 16 (App Router, Cache Components) + Prisma 7 + PostgreSQL + Tailwind CSS 4.

## Fitur

**Peserta**
- Daftar akun, lalu ajukan pendaftaran: pilih tim yang sedang dibuka, jenis magang (Mandiri atau MagangHub), tanggal mulai–selesai, dan motivasi
- MagangHub khusus lulusan, jadi wajib mengisi tahun lulus
- Unggah dokumen: CV (wajib semua), surat pengantar kampus/sekolah (wajib Mandiri). PDF/JPG/PNG maks. 2 MB, jenis file dicek dari isinya
- Tim hanya bisa dipilih selama jadwal pendaftarannya buka dan kuotanya belum penuh
- Absensi masuk/pulang berbasis lokasi (GPS browser, divalidasi radius di server) + swafoto dari kamera depan (bisa dimatikan admin)
- Tidak bisa absen di hari libur atau di luar hari kerja; riwayat menampilkan alpa dan libur
- Aktivitas: "bekerja" hanya bisa dicatat setelah absen masuk; izin/sakit tercatat otomatis sebagai "tidak bekerja"
- Evaluasi bulanan: melihat nilai per aspek dan catatan dari admin tim
- Sertifikat: setelah periode magang berakhir, isi survei akhir → sertifikat A4 terbit (cetak / simpan PDF) dengan nomor, QR, dan halaman verifikasi publik `/verifikasi/<kode>`
- Notifikasi dalam aplikasi (ikon lonceng): pendaftaran disetujui/ditolak, evaluasi baru, pengingat survei, sertifikat terbit
- **Langkah hari ini** di atas setiap halaman: absen masuk → catat aktivitas → absen pulang, dengan tombol ke langkah berikutnya
- **Pengingat harian** (bisa dimatikan di Profil): absen masuk 15 menit menjelang jam masuk, catat aktivitas 1 jam sebelum jam pulang, absen pulang 15 menit setelah jam pulang. Muncul di lonceng dan sebagai notifikasi push di HP/laptop yang diaktifkan
- Navigasi HP berisi fitur harian: Beranda, Aktivitas, **Absen** (tombol tengah), Notifikasi, Menu
- Profil dan ganti password (kampus & jurusan dengan saran otomatis)

**Admin utama** (`SUPER_ADMIN`)
- Semua fitur admin tim untuk seluruh tim
- Kelola tim: buat, edit, buka/tutup pendaftaran, jadwal buka–tutup, kuota peserta, hapus (jika belum ada pendaftaran). Tim yang menerima pendaftaran tampil di halaman awal dan form pendaftaran
- Hari kerja (default Senin–Sabtu) dan hari libur; libur nasional & cuti bersama 2026 sudah terisi
- Kelola akun admin: buat admin utama/admin tim, pindahkan tim, aktif/nonaktifkan
- Pengaturan sertifikat: nama instansi, kota, nama & jabatan penandatangan
- Pengaturan absensi: atur titik kantor dan radius langsung di peta (klik/geser titik, slider radius, "Pakai lokasi saya"), serta jam kerja
- Aktif/nonaktifkan akun peserta

**Admin tim** (`TEAM_ADMIN`), hanya untuk timnya
- Ringkasan harian, setujui/tolak pendaftaran, daftar dan detail peserta
- Monitor absensi dan aktivitas per tanggal
- Notifikasi: pendaftaran baru di timnya, laporan izin/sakit peserta
- Hasil survei akhir: rata-rata per pertanyaan dan semua jawaban
- Koreksi absensi per hari (status, jam, keterangan, alasan wajib) — tercatat di log dan dikabarkan ke peserta
- Lihat dokumen pendaftaran dan swafoto absen peserta timnya
- Laporan akhir/sementara magang siap cetak (identitas, rekap kehadiran + alpa, evaluasi, aktivitas, absensi harian)
- Log admin: siapa melakukan apa dan kapan, bisa difilter
- Evaluasi bulanan: nilai 0–100 untuk kedisiplinan, kualitas kerja, komunikasi, inisiatif, kerja sama, plus catatan; rekap kehadiran bulan itu ditampilkan di form

## Menjalankan

```bash
cp .env.example .env        # isi DATABASE_URL dan SESSION_SECRET
npm install                 # juga menjalankan prisma generate
npm run db:migrate          # buat tabel
npm run db:seed             # buat akun admin (ADMIN_EMAIL / ADMIN_PASSWORD di .env)
npm run dev
```

Data demo: `SEED_DEMO=1 npm run db:seed` membuat 4 tim, admin tim `admin.web@demo.local`, `admin.mobile@demo.local`, `admin.uiux@demo.local`, dan 3 peserta. Semua password demo: `Demo#12345`.

Produksi: `npm run db:deploy && npm run build && npm start`.

## Tes end-to-end

Tes Playwright ada di `e2e/` (5 suite, ±200 pengecekan). Butuh Postgres **khusus tes**: isinya dihapus setiap kali tes dijalankan, dan tes menolak berjalan kalau database bukan lokal atau namanya tidak mengandung `test`.

```bash
npx playwright install chromium        # sekali saja
createdb magang_test                   # atau buat lewat tool Postgres Anda
E2E_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/magang_test" npm run test:e2e
```

`E2E_SKIP_BUILD=1` melewati `next build` kalau sudah build. CI (GitHub Actions, `.github/workflows/e2e.yml`) menjalankan typecheck, lint, dan semua tes di setiap PR.

## Pengingat & notifikasi push

1. Buat kunci VAPID: `npx web-push generate-vapid-keys`, lalu isi `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT` (mis. `mailto:admin@kantor.id`) di environment server.
2. Isi `CRON_SECRET` dengan string acak panjang.
3. Jadwalkan pemanggilan endpoint pengingat **setiap 10–15 menit** di jam kerja. Endpoint sendiri yang menentukan siapa perlu diingatkan, dan setiap pengingat hanya dikirim sekali per hari:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://domain-anda/api/cron/pengingat
   ```
   Pilihan penjadwal:
   - **GitHub Actions**: sudah ada `.github/workflows/pengingat.yml` (setiap 15 menit, 06:45–19:59 WIB). Isi secret repo `APP_URL` dan `CRON_SECRET`. Jadwal GitHub bisa terlambat beberapa menit.
   - **VPS**: `*/10 6-19 * * * curl -fsS -H "Authorization: Bearer RAHASIA" https://domain-anda/api/cron/pengingat`
   - Layanan seperti cron-job.org, atau Vercel Cron (paket yang mendukung jadwal per menit).

Tanpa VAPID, pengingat tetap muncul di ikon lonceng saat aplikasi dibuka. Push butuh HTTPS. Di iPhone/iPad, push hanya bisa setelah portal ditambahkan ke Layar Utama (iOS 16.4+).

## Penyimpanan file

Dokumen pendaftaran dan swafoto disimpan di disk lokal, folder `storage/` (ubah lewat `STORAGE_DIR`), dan disajikan lewat `/api/berkas/...` dengan cek hak akses. **Disk lokal tidak permanen di hosting serverless seperti Vercel**: sebelum deploy ke sana, ganti fungsi di `src/lib/storage.ts` ke S3/Cloudflare R2/Vercel Blob. Di VPS biasa, cukup pastikan folder `storage/` ikut di-backup.

## Keamanan & operasional

- **Sesi**: JWT di cookie httpOnly (7 hari). Ganti/reset password atau menonaktifkan akun langsung membatalkan sesi lama di semua perangkat.
- **Batas percobaan**: login diblokir 15 menit setelah 5 kali gagal per email (atau 20 kali per IP); maksimal 5 akun baru per IP per jam. IP dibaca dari `x-forwarded-for`, jadi jalankan di belakang proxy/platform tepercaya (Vercel, Cloudflare, nginx).
- **Lupa password**: belum ada email. Admin tim (untuk pesertanya) atau admin utama (semua akun) menekan **Reset password** dan menyampaikan password sementara.
- **Header keamanan**: `X-Frame-Options`, `Permissions-Policy` (geolokasi hanya situs ini), HSTS, dan CSP minimal di `next.config.ts`.
- **Health check**: `GET /api/health` → `200 {"status":"ok"}` atau `503` jika database tidak terjangkau.
- **Export**: CSV absensi (maks. 93 hari) dan evaluasi per bulan, mengikuti scope tim. Pemisah `;` + BOM agar langsung rapi di Excel lokal Indonesia.
- **PWA**: ada `manifest.webmanifest` dan ikon, jadi portal bisa "Tambahkan ke layar utama" di HP.

## Catatan

- Zona waktu "hari ini" dan jam kerja memakai WIB (`src/lib/dates.ts`).
- Lokasi dari browser bisa dipalsukan; validasi radius mengurangi, bukan menghilangkan, kecurangan.
- `src/proxy.ts` hanya pengecekan awal; otorisasi sebenarnya ada di `requireUser()` / `requireAdmin()` dan setiap Server Action.
- Setelah `git pull` yang mengubah `prisma/schema.prisma`, jalankan `npx prisma generate` dan `npm run db:deploy`.
