import { db } from '@/lib/db'
import { ok, requireActor, route } from '@/lib/api'

export const GET = route(async () => {
  await requireActor('invoice:read')
  const invoices = await db.invoice.findMany({
    orderBy: { dueDate: 'asc' },
    include: {
      termin: {
        include: { project: { select: { code: true, name: true, client: { select: { name: true } } } } },
      },
    },
  })
  return ok(invoices)
})
