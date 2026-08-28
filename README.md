# ERP Konsultan Lingkungan

Aplikasi internal untuk mengelola operasional perusahaan jasa konsultan lingkungan —
dari **tender**, **kontrak**, **pekerjaan teknis**, **keuangan**, **HR**, sampai
**penutupan proyek** dan **survey kepuasan klien**.

Dibangun mengikuti dokumen *Alur Sistem Operasional Konsultan Lingkungan
(SOP, HR, Finance, Notifikasi)*.

---

## Apa yang bisa dilakukan sistem ini?

| Kebutuhan sehari-hari | Bagaimana sistem membantu |
| --- | --- |
| Tim marketing memantau tender | Semua tender tercatat lengkap dengan tenggat unggah dan probabilitas menang |
| Takut lupa deadline | Sistem mengirim peringatan otomatis (H-3 tender, H-14 laporan, H-60 sertifikat, dll.) |
| Biaya tender tercampur biaya proyek | Dipisah tegas: **Pola 1** (biaya tender, hangus bila kalah) vs **Pola 2** (biaya proyek/HPP) |
| Penagihan telat | Termin I/II/III terjadwal, invoice hanya terbit bila BAP terverifikasi |
| Tenaga ahli sertifikatnya kedaluwarsa | Database sertifikasi + peringatan 60 hari sebelum habis |
| Menilai kinerja tim | KPI tahunan (karyawan tetap) dan per-proyek (tenaga ahli) |
| Tahu klien puas atau tidak | Survey CSAT berbobot: teknis 35%, waktu 25%, komunikasi 20%, administrasi 20% |

---

## Menjalankan di komputer sendiri

Butuh **Node.js 20+** dan **PostgreSQL**.

```bash
# 1. Siapkan database (sekali saja)
brew install postgresql@17
brew services start postgresql@17
createdb konsultan_erp

# 2. Salin konfigurasi
cp .env.example .env      # lalu sesuaikan DATABASE_URL bila perlu

# 3. Pasang, migrasi, isi data contoh
npm run setup

# 4. Jalankan
npm run dev
```

Buka <http://localhost:3000>.

### Perintah yang sering dipakai

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan aplikasi untuk pengembangan |
| `npm test` | Menjalankan seluruh tes |
| `npm run test:coverage` | Tes + laporan cakupan kode |
| `npm run db:studio` | Membuka tampilan visual isi database |
| `npm run db:reset` | Mengosongkan dan mengisi ulang database contoh |

---

## Aturan bisnis yang dikunci di kode

Bagian ini bukan sekadar catatan — semuanya diuji otomatis, jadi tidak bisa
dilanggar tanpa tes gagal.

### Keuangan — dua pola biaya

**Pola 1 · Biaya Tender** (non-refundable)
Dikeluarkan sebelum menang. Dicatat sebagai biaya operasional umum, tidak
dibebankan ke proyek manapun.
- Wajib disetujui **dua pihak**: Direktur dan Finance Manager
- Hanya boleh diajukan bila probabilitas menang **minimal 60%**

**Pola 2 · Biaya Proyek** (dicover anggaran)
Muncul setelah SPK/kontrak ditandatangani. Dicatat sebagai direct cost (HPP)
per Job Order ID.

**Termin penagihan**

| Termin | Pemicu | Porsi |
| --- | --- | --- |
| I | Kontrak ditandatangani | 20–30% |
| II | Draft laporan / survey selesai | 40–50% |
| III | BAST & izin lingkungan terbit | 20–30% |

Invoice hanya boleh terbit setelah **BAP terverifikasi**.

### Peringatan otomatis

| Kategori | Kapan diingatkan | Penerima |
| --- | --- | --- |
| Deadline tender | H-3, H-1 | Marketing, PM, Finance |
| Deadline laporan | H-14, H-7, H-3 | Teknis, PM |
| Waktu penagihan | H-3 / saat milestone tercapai | Finance, PM |
| Jatuh tempo pembayaran | H-3 dan H+1 | Finance |
| Kontrak berakhir | H-30, H-14 | PM, Admin/Legal |
| Sertifikat ahli habis | H-60 | HR & personel terkait |

### Alur teknis yang dipaksa berurutan

Studi literatur → Sampling & survey lapangan → Uji lab terakreditasi KAN (dengan
Chain of Custody) → Draft laporan → Sidang komisi penilai → Laporan final → BAST → CSAT

---

## Struktur proyek

Dirancang supaya **tampilan bisa diganti total** (misalnya membeli template)
tanpa menyentuh logika bisnis.

```
src/
├── server/          ← ATURAN BISNIS. Tidak ikut terbuang saat ganti UI.
│   ├── shared/          konstanta & tipe domain bersama
│   ├── finance/         pola biaya, termin, invoice
│   ├── hr/              KPI, sertifikasi, rekrutmen
│   ├── notifications/   mesin peringatan otomatis
│   └── lifecycle/       tender, proyek, deliverable, BAST, CSAT
├── app/api/         ← KONTRAK. Endpoint bertipe, dipakai UI manapun.
├── app/(dashboard)/ ← TAMPILAN. Lapisan tipis yang boleh diganti bebas.
└── lib/             koneksi database & utilitas
```

Tiap domain di `src/server/` dipisah dua:
`rules.ts` berisi fungsi murni tanpa database (mudah diuji), `service.ts`
mengurus penyimpanan. Fungsi yang bergantung waktu selalu menerima parameter
`now` agar bisa diuji tanpa menunggu tanggal sungguhan.

### Mengganti tampilan

1. Hapus isi `src/app/(dashboard)/`
2. Pasang template baru di tempat yang sama
3. Sambungkan ke endpoint di `src/app/api/`

Warna, font, dan sudut membulat diatur lewat CSS variable terpusat, jadi
penyesuaian tema tidak perlu menyentuh satu per satu komponen.

---

## Pengujian

Aturan bisnis di `src/server/` wajib tercakup **100%** — ambangnya dipaksa oleh
`vitest.config.ts`, sehingga penurunan cakupan akan menggagalkan build.

```bash
npm run test:coverage
```

Lapisan tampilan sengaja tidak dipaksa 100%, karena memang dirancang untuk
diganti.

---

## Akun uji coba

Setelah `npm run setup`, seluruh akun contoh memakai kata sandi
`Lingkungan2026`. Beberapa yang berguna untuk membandingkan hak akses:

| Peran | Email |
| --- | --- |
| Direktur — berwenang penuh | `bambang.sutrisno@hijaunusantara.co.id` |
| Finance Manager | `retno.wulandari@hijaunusantara.co.id` |
| Project Manager teknis | `siti.nurhaliza@hijaunusantara.co.id` |
| Staf teknis — akses paling terbatas | `yudi.hermawan@hijaunusantara.co.id` |
| Staf marketing | `rizky.ramadhan@hijaunusantara.co.id` |

Daftar lengkap dicetak di akhir proses seed. Masuk sebagai Direktur lalu
sebagai staf teknis untuk melihat perbedaan wewenangnya.

## Status pengembangan

- [x] Skema database & pondasi proyek
- [x] Domain keuangan, HR, notifikasi, dan siklus proyek — 357 tes, cakupan 100%
- [x] Autentikasi & hak akses per divisi
- [x] Endpoint API
- [x] Antarmuka dashboard & sistem tema
- [x] Data contoh untuk uji coba

Belum dikerjakan:

- [ ] Formulir pengisian data lewat antarmuka (saat ini pengisian melalui seed
      atau langsung ke basis data; seluruh aturan dan endpointnya sudah siap)
- [ ] Pengiriman email sungguhan untuk peringatan — titik sambungnya ada pada
      `NotificationSender`, saat ini hanya mencatat ke basis data
- [ ] Penjadwal berkala yang memanggil `/api/notifications/scan`
- [ ] Unggah dan penyimpanan berkas dokumen
- [ ] Penyiapan penempatan ke server
