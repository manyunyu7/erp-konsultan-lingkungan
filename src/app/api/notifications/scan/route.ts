import { ok, requireActor, route } from '@/lib/api'
import { runNotificationScan } from '@/server/notifications'

/**
 * Titik masuk pemindaian peringatan. Dipanggil penjadwal (cron) atau manual
 * dari halaman pengaturan. Aman dipanggil berulang karena prosesnya idempoten.
 */
export const POST = route(async () => {
  await requireActor('notification:read')
  const hasil = await runNotificationScan({ now: new Date() })
  return ok(hasil)
})
