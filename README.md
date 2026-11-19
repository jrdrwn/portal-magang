# Portal Magang

Next.js 16 (App Router, Cache Components) + Prisma 7 + PostgreSQL + Tailwind CSS 4.

## Fitur

**Peserta**
- Daftar akun, lalu ajukan pendaftaran: pilih tim yang sedang dibuka, jenis magang (Mandiri atau MagangHub), tanggal mulai–selesai, dan motivasi
- MagangHub khusus lulusan, jadi wajib mengisi tahun lulus
- Absensi masuk/pulang berbasis lokasi (GPS browser, divalidasi radius di server)
- Aktivitas: "bekerja" hanya bisa dicatat setelah absen masuk; izin/sakit tercatat otomatis sebagai "tidak bekerja"
- Evaluasi bulanan: melihat nilai per aspek dan catatan dari admin tim
- Profil dan ganti password

**Admin utama** (`SUPER_ADMIN`)
- Semua fitur admin tim untuk seluruh tim
- Kelola tim: buat, edit, buka/tutup pendaftaran, hapus (jika belum ada pendaftaran). Tim yang dibuka tampil di halaman awal dan form pendaftaran
- Kelola akun admin: buat admin utama/admin tim, pindahkan tim, aktif/nonaktifkan
- Pengaturan absensi: atur titik kantor dan radius langsung di peta (klik/geser titik, slider radius, "Pakai lokasi saya"), serta jam kerja
- Aktif/nonaktifkan akun peserta

**Admin tim** (`TEAM_ADMIN`), hanya untuk timnya
- Ringkasan harian, setujui/tolak pendaftaran, daftar dan detail peserta
- Monitor absensi dan aktivitas per tanggal
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
