import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { PERMISSIONS } from '@/server/auth'
import {
  SUBJECT_TYPES,
  editablePermissionsFor,
  isSubjectLocked,
  listGrants,
  replaceGrants,
  seedDefaultsIfEmpty,
} from '@/server/authz'
import { DIVISIONS, ROLES } from '@/server/shared/constants'

export const GET = route(async () => {
  await requireActor('user:read')

  // Pengisian awal dilakukan saat pertama kali dibuka, supaya administrator
  // melihat matriks yang benar-benar berlaku, bukan tabel kosong.
  await seedDefaultsIfEmpty()

  return ok({
    permissions: PERMISSIONS,
    roles: ROLES.map((subject) => ({
      subject,
      terkunci: isSubjectLocked('ROLE', subject),
      dapatDisunting: editablePermissionsFor('ROLE', subject),
    })),
    divisions: DIVISIONS.map((subject) => ({
      subject,
      terkunci: isSubjectLocked('DIVISION', subject),
      dapatDisunting: editablePermissionsFor('DIVISION', subject),
    })),
    grants: await listGrants(),
  })
})

const skema = z.object({
  subjectType: z.enum(SUBJECT_TYPES),
  subject: z.string().min(1),
  permissions: z.array(z.string()),
})

export const PUT = route(async (request: Request) => {
  await requireActor('user:write')

  const body = await readJson(request, (value) => {
    const hasil = skema.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Batasan mana yang boleh diberikan dijaga di lapisan domain.
  const grants = await replaceGrants(body.subjectType, body.subject, body.permissions)
  return ok(grants)
})
