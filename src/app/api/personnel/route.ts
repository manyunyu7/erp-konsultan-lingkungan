import { db } from '@/lib/db'
import { ok, requireActor, route } from '@/lib/api'

export const GET = route(async () => {
  await requireActor('personnel:read')
  const personnel = await db.personnel.findMany({
    orderBy: { fullName: 'asc' },
    include: {
      certifications: { orderBy: { expiresAt: 'asc' } },
      assignments: { include: { project: { select: { code: true } } } },
    },
  })
  return ok(personnel)
})
