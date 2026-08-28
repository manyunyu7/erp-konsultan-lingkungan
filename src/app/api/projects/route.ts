import { db } from '@/lib/db'
import { ok, requireActor, route } from '@/lib/api'

export const GET = route(async () => {
  await requireActor('project:read')
  const projects = await db.project.findMany({
    orderBy: { endDate: 'asc' },
    include: {
      client: { select: { name: true } },
      projectManager: { select: { name: true } },
      termins: { orderBy: { sequence: 'asc' } },
      deliverables: { orderBy: { dueDate: 'asc' } },
      bast: true,
      csat: true,
    },
  })
  return ok(projects)
})
