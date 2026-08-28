# Mengganti Tampilan

Sistem ini dirancang agar tampilannya bisa diganti total — termasuk memasang
template yang dibeli — tanpa menyentuh logika bisnis.

## Tiga lapis yang perlu dipahami

```
src/server/          Aturan bisnis. JANGAN DIGANTI saat ganti tampilan.
src/app/api/         Kontrak data. Bentuk balasannya tetap.
src/app/(dashboard)/ Tampilan. Boleh dibuang seluruhnya.
src/components/      Komponen tampilan. Boleh dibuang seluruhnya.
```

Aturan bisnis tidak tahu-menahu soal React. Karena itu mengganti antarmuka tidak
berisiko merusak perhitungan termin, aturan persetujuan, atau penjadwalan
peringatan — semuanya dijaga 299 tes otomatis.

## Cara paling ringan: ganti temanya saja

Bila hanya ingin mengubah rupa, cukup sunting `src/app/globals.css`. Seluruh
warna berasal dari variabel di sana.

```css
:root {
  --primary: oklch(0.52 0.11 160);   /* warna utama */
  --background: oklch(0.99 0.004 145);
  --radius-base: 0.625rem;
}
```

Menambah preset warna baru = menambah satu blok, lalu daftarkan namanya di
`src/components/theme/theme-provider.tsx` pada `COLOR_PRESETS`.

Tidak ada komponen yang menuliskan warna secara langsung. Ini aturan yang
dijaga: bila ada `bg-blue-500` menyelinap masuk, tema tidak lagi bisa diganti
utuh.

## Memasang template beli

Penamaan token mengikuti konvensi **shadcn/ui** (`--background`, `--foreground`,
`--primary`, `--muted`, `--border`, dan seterusnya), yang dipakai mayoritas
template Tailwind komersial. Artinya template semacam itu umumnya bisa langsung
menempel.

Langkahnya:

1. **Hapus** isi `src/app/(dashboard)/` dan `src/components/ui/`.
2. **Pasang** template ke lokasi yang sama.
3. **Samakan** nama variabel warna template dengan yang ada di `globals.css`,
   atau sebaliknya.
4. **Sambungkan** halaman ke data. Dua pilihan:
   - Komponen server: baca langsung lewat `db` dari `@/lib/db` (paling cepat)
   - Komponen klien / template terpisah: panggil endpoint di `/api`

5. **Pertahankan** pemeriksaan izin. Tiap halaman wajib memanggil
   `can(actor, 'izin:yang:sesuai')`. Endpoint sudah menolak sendiri, tetapi
   menyembunyikan menu yang tidak berlaku membuat aplikasi terasa benar.

## Kontrak API

Semua endpoint membalas dengan bentuk yang sama:

```jsonc
// berhasil
{ "data": ... }

// gagal
{ "error": { "message": "...", "code": "..." } }
```

| Kode HTTP | Arti |
| --- | --- |
| 401 | Belum masuk atau sesi kedaluwarsa |
| 403 | Sudah masuk, tetapi tidak berwenang |
| 422 | Permintaannya sah, tetapi melanggar aturan bisnis |
| 500 | Kesalahan sistem |

Endpoint yang tersedia:

| Metode | Alamat | Izin |
| --- | --- | --- |
| POST | `/api/auth/login` | — |
| POST | `/api/auth/logout` | — |
| GET | `/api/auth/me` | sudah masuk |
| GET | `/api/dashboard` | sudah masuk |
| GET | `/api/tenders` | `tender:read` |
| GET | `/api/projects` | `project:read` |
| GET | `/api/invoices` | `invoice:read` |
| GET | `/api/personnel` | `personnel:read` |
| GET | `/api/notifications` | `notification:read` |
| POST | `/api/notifications/scan` | `notification:read` |

## Setelah mengganti tampilan

Jalankan:

```bash
npm test          # aturan bisnis harus tetap hijau
npx tsc --noEmit  # tidak ada kesalahan tipe
npx next build    # aplikasi tetap bisa dibangun
```

Bila `npm test` gagal setelah Anda hanya mengubah tampilan, berarti ada logika
bisnis yang ikut terbawa ke lapisan tampilan — kembalikan ke `src/server/`.
