# Portal Magang

Next.js 16 (App Router, Cache Components) + Prisma 7 + PostgreSQL + Tailwind CSS 4.

## Fitur

**Peserta**
- Daftar akun, ajukan pendaftaran magang (divisi, tanggal mulai–selesai, motivasi)
- Absensi masuk/pulang berbasis lokasi (GPS browser, divalidasi radius di server)
- Aktivitas: "bekerja" hanya bisa dicatat setelah absen masuk; izin/sakit tercatat otomatis sebagai "tidak bekerja"
- Profil dan ganti password

**Admin**
- Ringkasan harian dan grafik kehadiran 7 hari
- Setujui/tolak pendaftaran
- Daftar dan detail peserta, aktif/nonaktifkan akun
- Monitor absensi dan aktivitas per tanggal (termasuk yang belum absen/alpa)
- Pengaturan titik kantor, radius, dan jam kerja

## Menjalankan

```bash
cp .env.example .env        # isi DATABASE_URL dan SESSION_SECRET
npm install                 # juga menjalankan prisma generate
npm run db:migrate          # buat tabel
npm run db:seed             # buat akun admin (ADMIN_EMAIL / ADMIN_PASSWORD di .env)
npm run dev
```

Data demo (3 peserta + riwayat): `SEED_DEMO=1 npm run db:seed` (password peserta `Demo#12345`).

Produksi: `npm run db:deploy && npm run build && npm start`.

## Catatan

- Zona waktu "hari ini" dan jam kerja memakai WIB (`src/lib/dates.ts`).
- Lokasi dari browser bisa dipalsukan; validasi radius mengurangi, bukan menghilangkan, kecurangan.
- Sesi: JWT di cookie httpOnly. `src/proxy.ts` hanya pengecekan awal; otorisasi sebenarnya ada di `requireUser()`.
