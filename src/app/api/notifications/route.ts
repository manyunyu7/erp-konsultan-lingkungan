import { db } from '@/lib/db'
import { ok, requireActor, route } from '@/lib/api'

export const GET = route(async () => {
  const actor = await requireActor('notification:read')
  // Hanya notifikasi yang memang ditujukan kepada pengguna ini.
  const rows = await db.notificationRecipient.findMany({
    where: { userId: actor.id },
    orderBy: { notification: { triggerAt: 'desc' } },
    include: { notification: true },
    take: 100,
  })
  return ok(rows.map((row) => ({ ...row.notification, readAt: row.readAt })))
})
