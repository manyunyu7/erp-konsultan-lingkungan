# Panduan Pengguna

Ditujukan untuk seluruh staf. Tidak perlu latar belakang teknis.

---

## Masuk ke sistem

1. Buka alamat aplikasi di peramban.
2. Masukkan email kantor dan kata sandi Anda.
3. Klik **Masuk**.

Bila muncul "Email atau kata sandi salah", periksa kembali keduanya. Pesan ini
sengaja tidak memberi tahu bagian mana yang keliru, demi keamanan akun.

Bila muncul "Akun sudah dinonaktifkan", hubungi HR.

---

## Apa yang Anda lihat tergantung divisi

Sistem menyesuaikan menu dengan tugas Anda. Contohnya:

| Divisi | Yang bisa diakses |
| --- | --- |
| Marketing & Tender | Tender, daftar proyek, pengajuan biaya tender |
| Admin & Legal | Kontrak, dokumen legal, daftar personel |
| Keuangan | Biaya, invoice, penagihan, seluruh angka proyek |
| Operasional Teknis | Proyek, deliverable, sampel laboratorium |
| Human Resources | Personel, sertifikasi, KPI, CSAT |
| Manajemen / Direktur | Seluruh bagian, termasuk persetujuan biaya |

Menu yang tidak muncul memang bukan wewenang Anda — bukan kesalahan sistem.

---

## Beranda

Halaman pertama menampilkan ringkasan hari ini:

- **Tender aktif** — tender yang sedang diikuti
- **Proyek berjalan** — proyek yang belum ditutup
- **Peringatan belum dibaca** — hal yang menunggu tindakan Anda
- **Invoice lewat jatuh tempo** — hanya tampil bagi yang berwenang

Di bawahnya ada dua daftar: tenggat pekerjaan terdekat dan proyek berjalan.
Penanda berwarna menunjukkan tingkat urgensi:

| Penanda | Arti |
| --- | --- |
| Abu-abu | Masih lapang |
| Kuning | Tiga hari lagi atau kurang |
| Merah | Sudah lewat tenggat |

---

## Peringatan otomatis

Sistem mengingatkan sendiri tanpa perlu ada yang memantau kalender:

| Yang diingatkan | Kapan | Siapa yang menerima |
| --- | --- | --- |
| Tenggat unggah dokumen tender | 3 hari dan 1 hari sebelumnya | Marketing, PM, Keuangan |
| Penyerahan laporan | 14, 7, dan 3 hari sebelumnya | Teknis, PM |
| Waktu penagihan | 3 hari sebelumnya, atau saat milestone tercapai | Keuangan, PM |
| Jatuh tempo pembayaran klien | 3 hari sebelum, dan 1 hari setelah lewat | Keuangan |
| Kontrak akan berakhir | 30 dan 14 hari sebelumnya | PM, Admin & Legal |
| Sertifikat tenaga ahli akan habis | 60 hari sebelumnya | HR dan orang bersangkutan |

Tiap peringatan menyebutkan **tindakan yang harus dilakukan**, bukan sekadar
memberi tahu.

---

## Alur kerja yang dijaga sistem

Beberapa langkah sengaja tidak bisa dilompati, karena inilah yang paling sering
menimbulkan masalah di kemudian hari.

### Biaya tender (Pola 1)

Biaya yang keluar **sebelum** menang tender. Bila kalah, biaya ini hangus dan
dicatat sebagai beban operasional — tidak boleh dibebankan ke proyek lain.

Syarat pengajuan:
- Probabilitas menang minimal **60%**
- Disetujui **dua orang**: Direktur dan Finance Manager

Bila salah satu menolak, pengajuan ditolak.

### Biaya proyek (Pola 2)

Biaya setelah kontrak/SPK ditandatangani. Ditanggung anggaran proyek dan
dicatat per kode proyek.

### Penagihan

| Termin | Bisa ditagih setelah | Porsi |
| --- | --- | --- |
| I | Kontrak ditandatangani | 20–30% |
| II | Draft laporan / survei lapangan selesai | 40–50% |
| III | BAST dan izin lingkungan terbit | 20–30% |

Invoice **tidak bisa** diterbitkan sebelum BAP terverifikasi. Ini disengaja:
menagih tanpa BAP hampir selalu berakhir dengan tagihan tertahan di klien.

### Pekerjaan teknis

Urutannya dikunci:

```
Studi literatur → Survei & pengambilan sampel → Uji lab terakreditasi KAN
→ Draft laporan → Sidang komisi penilai → Laporan final
```

Laporan tidak bisa ditandai "diserahkan" sebelum lolos QC internal. Sampel tidak
bisa dikirim ke laboratorium tanpa nomor Chain of Custody.

### Penutupan proyek

BAST hanya bisa terbit setelah laporan final disetujui. Proyek hanya bisa
ditutup setelah BAST ada. Setelah BAST ditandatangani, formulir CSAT dikirim ke
klien.

Nilai CSAT dihitung berbobot:

| Aspek | Bobot |
| --- | --- |
| Kualitas teknis | 35% |
| Ketepatan waktu | 25% |
| Komunikasi & respons | 20% |
| Administrasi & kelengkapan | 20% |

Hasilnya memengaruhi KPI Project Manager dan tim teknis terkait.

---

## Mengatur tampilan sesuai selera

Menu **Tampilan** memungkinkan tiap orang mengatur sendiri:

- **Warna utama** — empat pilihan preset
- **Mode terang / gelap** — atau mengikuti pengaturan komputer
- **Kerapatan** — rapat untuk melihat lebih banyak baris, lega agar lebih nyaman
- **Sudut membulat** — dari kotak tegas sampai sangat membulat

Pengaturan tersimpan di peramban Anda sendiri dan tidak memengaruhi tampilan
rekan kerja lain.

---

## Pertanyaan yang sering muncul

**Saya tidak bisa menerbitkan invoice.**
Periksa dua hal: BAP sudah terverifikasi, dan milestone termin sudah tercapai.
Bila keduanya sudah, kemungkinan Anda memang tidak berwenang — hubungi
Keuangan.

**Pengajuan biaya tender saya ditolak sistem.**
Probabilitas menang tender di bawah 60%. Perbarui penilaian tender bila memang
sudah berubah, atau ajukan pengecualian ke Direktur.

**Nama tenaga ahli tidak bisa ditugaskan ke proyek AMDAL.**
Sertifikatnya sudah kedaluwarsa, atau akan kedaluwarsa sebelum penugasan
dimulai. HR perlu memperbarui data sertifikat lebih dulu.

**Angka nominal tidak muncul di layar saya.**
Nilai keuangan hanya ditampilkan kepada divisi yang berwenang.
