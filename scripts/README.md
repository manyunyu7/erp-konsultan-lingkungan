# Skrip operasional

## `pindai-peringatan.ts` — pemindaian peringatan terjadwal

Memeriksa seluruh tenggat menurut SOP (tender, pekerjaan teknis, penagihan,
pembayaran lewat tempo, kontrak, sertifikat), membuat peringatan yang sudah
jatuh tempo, lalu mengirim yang masih `PENDING`.

```bash
npm run pindai:peringatan
```

Keluaran berupa ringkasan `dibuat / dilewati / dikirim / gagal kirim`, dan kode
keluar `0` bila sukses, `1` bila gagal — supaya penjadwal bisa mendeteksi
kegagalan, bukan menganggapnya berhasil diam-diam.

Skrip **aman dijalankan berulang**: pembuatan peringatan dikunci oleh indeks
unik `[category, entityId, offsetDays]`, sehingga eksekusi kedua pada hari yang
sama menaikkan angka "dilewati", bukan membuat duplikat.

Skrip memanggil lapisan domain langsung, bukan lewat HTTP. Alasannya penjadwal
tidak memiliki sesi pengguna, sedangkan `POST /api/notifications/scan`
memerlukan izin `notification:read`.

### Memasang ke cron

Jalankan tiap pagi pukul 07:00 WIB, sebelum jam kerja dimulai:

```cron
# Zona waktu dinyatakan eksplisit karena server bisa saja berjalan di UTC.
CRON_TZ=Asia/Jakarta
0 7 * * * cd /srv/konsultan-lingkungan-erp && /usr/bin/npm run pindai:peringatan >> /var/log/erp/pindai-peringatan.log 2>&1
```

Bila `cron` yang dipakai tidak mendukung `CRON_TZ`, setel zona waktu sistem ke
`Asia/Jakarta`, atau jadwalkan pada `0 0 * * *` UTC yang setara dengan 07:00 WIB.

Skrip membaca `DATABASE_URL` dari berkas `.env` di akar repositori
(lewat `dotenv/config`), jadi cron tidak perlu mewarisi environment shell.

### Catatan: pengiriman email belum tersambung

Pengirim bawaan adalah `createLogNotificationSender()` — peringatan **tidak**
dikirim lewat email atau WhatsApp, hanya dicatat ke log lalu ditandai `SENT` di
basis data. Staf tetap melihatnya di halaman **Peringatan** aplikasi.

Titik sambung integrasi adalah antarmuka `NotificationSender`
(`src/server/notifications/service.ts`):

```ts
export interface NotificationSender {
  send(notification: OutboundNotification): Promise<void>
}
```

Untuk menyambungkan email sungguhan, buat implementasi antarmuka tersebut dan
pasang pada konstanta `sender` di `scripts/pindai-peringatan.ts`. Tidak ada
bagian lain dari sistem yang perlu berubah. Bila `send()` melempar galat,
peringatan sengaja dibiarkan `PENDING` supaya eksekusi berikutnya mencobanya
lagi.
