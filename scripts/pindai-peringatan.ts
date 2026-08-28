/**
 * Pemindaian peringatan untuk penjadwal (cron).
 *
 * Dijalankan sebagai proses Node biasa dan memanggil lapisan domain langsung,
 * bukan lewat HTTP — penjadwal tidak punya sesi pengguna, sehingga rute
 * `/api/notifications/scan` (yang memang butuh izin `notification:read`)
 * tidak cocok dipakai di sini.
 *
 * Seluruh aturan "peringatan apa yang harus ada" tetap milik
 * `src/server/notifications`; berkas ini hanya memanggil dan melaporkan.
 */

import 'dotenv/config'
import { createLogNotificationSender, runNotificationScan } from '../src/server/notifications'
import type { NotificationSender } from '../src/server/notifications'

// Titik sambung kanal pengiriman. Ganti dengan implementasi email/WhatsApp
// nanti tanpa mengubah bagian lain dari skrip ini.
const sender: NotificationSender = createLogNotificationSender()

async function main(): Promise<void> {
  const now = new Date()
  const hasil = await runNotificationScan({ now, sender })

  // Ringkasan satu blok agar mudah dibaca di log cron atau `journalctl`.
  console.log(`[pindai-peringatan] waktu acuan : ${now.toISOString()}`)
  console.log(`[pindai-peringatan] dibuat      : ${hasil.created}`)
  console.log(`[pindai-peringatan] dilewati    : ${hasil.skipped} (sudah ada sebelumnya)`)
  console.log(`[pindai-peringatan] dikirim     : ${hasil.sent}`)
  console.log(`[pindai-peringatan] gagal kirim : ${hasil.failed} (tetap PENDING, dicoba lagi)`)
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    // Keluar dengan kode 1 supaya penjadwal dapat mendeteksi kegagalan;
    // tanpa ini cron akan menganggap pemindaian yang gagal sebagai sukses.
    console.error('[pindai-peringatan] GAGAL:', error)
    process.exit(1)
  })
