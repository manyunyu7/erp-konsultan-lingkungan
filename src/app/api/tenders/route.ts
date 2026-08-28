import { db } from '@/lib/db'
import { ok, requireActor, route } from '@/lib/api'

export const GET = route(async () => {
  await requireActor('tender:read')
  const tenders = await db.tender.findMany({
    orderBy: { submissionDeadline: 'asc' },
    include: { client: { select: { name: true } }, project: { select: { code: true } } },
  })
  return ok(tenders)
})
