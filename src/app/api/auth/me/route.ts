import { ok, requireActor, route } from '@/lib/api'
import { permissionsFor } from '@/server/auth'
import { db } from '@/lib/db'

export const GET = route(async () => {
  const actor = await requireActor()
  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { id: true, name: true, email: true, role: true, division: true },
  })
  // Izin ikut dikirim agar antarmuka bisa menyembunyikan menu yang tidak berlaku.
  return ok({ ...user, permissions: permissionsFor(actor) })
})
