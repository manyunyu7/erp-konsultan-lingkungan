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

6. **Izin diperiksa dua kali.** Endpoint menolak lewat `requireActor('izin')`,
   dan tampilan menyembunyikan menunya lewat `can(actor, 'izin')`. Keduanya
   memakai izin yang sama persis.

7. **Galat aturan bisnis memakai `BusinessRuleError`** dengan `code`
   deskriptif, bukan `throw new Error('gagal')`. Lapisan API memetakannya
   ke HTTP 422.

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
