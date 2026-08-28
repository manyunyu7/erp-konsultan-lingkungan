import { db } from '@/lib/db'
import { HttpError, ok, requireActor, route } from '@/lib/api'

/**
 * Menandai satu peringatan sebagai sudah dibaca.
 *
 * Penandaan menyasar baris NotificationRecipient milik aktor yang sedang
 * masuk — bukan notifikasinya. Dengan begitu seseorang tidak dapat menandai
 * peringatan orang lain, dan status baca tetap per penerima.
 */
export const PATCH = route(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireActor('notification:read')
    const { id } = await ctx.params

    const recipient = await db.notificationRecipient.findUnique({
      where: { notificationId_userId: { notificationId: id, userId: actor.id } },
    })
    if (!recipient) {
      // 404, bukan 403: keberadaan peringatan orang lain pun tidak dibocorkan.
      throw new HttpError(404, 'Peringatan tidak ditemukan untuk Anda.', 'NOTIFICATION_NOT_FOUND')
    }

    const updated = await db.notificationRecipient.update({
      where: { id: recipient.id },
      // Idempoten: penandaan ulang mempertahankan waktu baca yang pertama.
      data: { readAt: recipient.readAt ?? new Date() },
    })
    return ok(updated)
  },
)
