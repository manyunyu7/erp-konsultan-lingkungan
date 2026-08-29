# CLAUDE.md

Panduan kerja untuk Claude Code di repositori ini.

## Apa ini

ERP internal perusahaan jasa konsultan lingkungan (AMDAL/UKL-UPL/DELH/DPLH).
Sumber kebenaran aturan bisnis adalah dokumen *Alur Sistem Operasional
Konsultan Lingkungan (SOP, HR, Finance, Notifikasi)*. Bila kode dan dokumen itu
bertentangan, tanyakan — jangan diam-diam memilih salah satu.

Pengguna sasaran ~30 orang, terbagi enam divisi.

## Perintah

```bash
npm run dev             # jalankan aplikasi
npm test                # seluruh tes
npm run test:coverage   # tes + cakupan (ambang 100% untuk src/server)
npm run db:migrate      # migrasi setelah mengubah skema
npm run db:seed         # isi data contoh
npm run db:studio       # lihat isi database
npm run db:reset        # kosongkan lalu isi ulang data contoh
npm run pindai:peringatan   # jalankan pemindaian peringatan (dipakai cron)
```

Postgres lokal dijalankan lewat `brew services start postgresql@17`; `psql` ada
di `/opt/homebrew/opt/postgresql@17/bin`.

## Arsitektur — tiga lapis yang tidak boleh bocor

```
src/server/          aturan bisnis, nol React, nol JSX
src/app/api/         kontrak HTTP bertipe
src/app/(dashboard)/ tampilan; DIRANCANG UNTUK DIBUANG dan diganti template
```

Alasan pemisahan ini: pemilik proyek berencana suatu saat mengganti seluruh
antarmuka dengan template beli. Karena itu **jangan pernah menaruh aturan bisnis
di komponen atau route handler.** Bila sebuah perhitungan bisa salah dan
merugikan perusahaan, tempatnya di `src/server/`.

Tiap domain di `src/server/` dipecah dua:

- `rules.ts` — fungsi murni, dilarang mengimpor `@/lib/db`
- `service.ts` — satu-satunya yang menyentuh database

Domain yang ada: `finance`, `hr`, `lifecycle`, `notifications`, `auth`,
`authz` (matriks hak akses yang dapat disunting), `attachments` (lampiran
berkas), dan `usecases` (tes skenario lintas domain, tanpa kode produksi).

## Aturan yang tidak bisa ditawar

1. **Waktu selalu di-inject.** Setiap fungsi yang bergantung tanggal menerima
   parameter `now: Date`. Dilarang memanggil `new Date()` di dalam `rules.ts`.
   Tanpa ini, aturan H-3/H-14/H-60 tidak bisa diuji.

2. **Uang bukan `number`.** Perhitungan memakai `bigint` satuan sen
   (lihat `src/server/finance/rules.ts`). Pembulatan half-up, mengikuti
   konvensi faktur Indonesia.

3. **Zona waktu WIB +07:00 tetap.** Jangan menormalkan tanggal ke UTC —
   deadline 00:00 WIB tersimpan sebagai 17:00Z hari sebelumnya, sehingga
   normalisasi ke UTC menggeser seluruh hitungan H-x satu hari.

4. **Coverage 100% untuk `src/server/`.** Diberlakukan `vitest.config.mts`.
   Menurunkan ambang bukan solusi; tulis tesnya.

5. **Tidak ada warna tetap di komponen.** Hanya token tema (`bg-card`,
   `text-muted-foreground`, `var(--warning)`). Satu `bg-blue-500` yang lolos
   membuat tema tidak lagi bisa diganti utuh.

6. **Izin diperiksa dua kali, dan keduanya memakai matriks yang berlaku.**
   Endpoint menolak lewat `requireActor('izin')`; halaman menyembunyikan
   menunya lewat `await izinkan(actor, 'izin')` dari `@/lib/api`.

   JANGAN memakai `can()` yang sinkron di dalam halaman. Fungsi itu memakai
   matriks BAWAAN di kode, sedangkan matriks sesungguhnya kini tersimpan di
   basis data dan dapat disunting administrator — memakai `can()` membuat
   tampilan menawarkan menu yang justru ditolak API. `can()` hanya untuk
   pengujian dan pemakaian di dalam `src/server/`.

7. **Dua kunci hak akses tidak boleh dilonggarkan.** Izin `user:*` hanya
   milik peran `SUPERADMIN`, dan `SUPERADMIN` tidak boleh menerima wewenang
   bisnis apa pun. Tanpa itu administrator dapat memberi dirinya wewenang
   menyetujui biaya, lalu mengajukan sekaligus menyetujui pengeluarannya
   sendiri — dan gate dua-peran pada biaya tender kehilangan maknanya.
   Batasan ini diterapkan saat menyimpan DAN saat membaca matriks, supaya
   baris yang disunting langsung di basis data pun tidak dapat menembusnya.

8. **Berkas unggahan tidak pernah dinamai dari kiriman pengguna.** Jalur
   penyimpanan disusun dari tanggal, pengenal acak, dan akhiran dari daftar
   putih; nama kiriman hanya disimpan sebagai label tampilan. Berkas juga
   diletakkan di luar direktori publik agar setiap pengambilan melewati
   pemeriksaan izin.

9. **Galat aturan bisnis memakai `BusinessRuleError`** dengan `code`
   deskriptif, bukan `throw new Error('gagal')`. Lapisan API memetakannya
   ke HTTP 422.

## Jebakan yang sudah pernah memakan waktu

- **Setelah `prisma migrate` atau `prisma generate`, server dev WAJIB
  di-restart.** Proses `next dev` memegang Prisma Client lama, sehingga model
  baru muncul sebagai `undefined` dan galatnya menyesatkan
  (`Cannot read properties of undefined`).
- **Prisma dipatok di 7.10.0.** Tag `latest` menunjuk 8.0.0-rc yang
  arsitekturnya berbeda total. Jangan menaikkan versi tanpa sengaja.
- **`prisma db seed` mengganti seluruh pengguna**, sehingga pengenalnya
  berubah dan sesi yang sedang berjalan menjadi tidak sah. Login ulang setelah
  seed, jangan mengira autentikasinya rusak.
- **Jangan `git add -A`.** Repositori ini kerap punya pekerjaan paralel yang
  belum selesai; pernah membuat kode domain tercatat di bawah pesan commit
  yang salah. Stage per path eksplisit.
- **Perubahan matriks hak akses baru terasa merata setelah ~30 detik**
  (umur singgahan di `src/server/authz/service.ts`).
- **Folder `storage/` tidak masuk repositori** dan isinya tidak dapat
  dibangun ulang dari kode. Wajib ikut dicadangkan.

## Fitur khusus pengembangan

Pengalih akun tanpa kata sandi hidup hanya bila `NODE_ENV` bukan `production`
DAN `DEV_ACCOUNT_SWITCHER=1`. Saat mati, endpointnya membalas 404 dan daftar
akun tidak pernah dibentuk. Jangan pernah menyalakannya di server produksi.

## Gaya

- Komentar dan teks antarmuka: bahasa Indonesia. Nama variabel, fungsi, dan
  tipe: bahasa Inggris.
- Komentar menjelaskan **kenapa**, bukan mengulang apa yang sudah jelas dari
  kodenya.
- Nama tes menceritakan aturannya, bukan nama fungsinya:
  "menolak biaya tender bila probabilitas menang di bawah 60 persen".

## Git

Commit bertahap dengan pesan yang menjelaskan alasan perubahan. Stage per path
eksplisit, jangan `git add -A` — repositori ini kerap punya pekerjaan paralel
yang belum selesai. Remote: `manyunyu7/erp-konsultan-lingkungan`.

## Dokumentasi

- `README.md` — gambaran umum dan cara menjalankan
- `docs/panduan-pengguna.md` — untuk staf non-teknis
- `docs/mengganti-tampilan.md` — cara memasang template pengganti
- `scripts/README.md` — pemasangan penjadwal pemindaian peringatan

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
