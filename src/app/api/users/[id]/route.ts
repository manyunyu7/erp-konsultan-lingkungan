import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { DIVISIONS, ROLES } from '@/server/shared/constants'

const skema = z.object({
  name: z.string().min(3).optional(),
  role: z.enum(ROLES).optional(),
  division: z.enum(DIVISIONS).optional(),
  isActive: z.boolean().optional(),
})

export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireActor('user:write')
    const { id } = await ctx.params

    const body = await readJson(request, (value) => {
      const hasil = skema.safeParse(value)
      if (!hasil.success) {
        throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
      }
      return hasil.data
    })

    const target = await db.user.findUnique({ where: { id } })
    if (!target) throw new HttpError(404, 'Pengguna tidak ditemukan.', 'USER_NOT_FOUND')

    // Menonaktifkan atau menurunkan peran diri sendiri berisiko mengunci
    // administrator terakhir di luar sistem. Perubahan seperti itu harus
    // dilakukan oleh administrator lain.
    if (target.id === actor.id && (body.isActive === false || body.role !== undefined)) {
      throw new HttpError(
        422,
        'Peran dan status akun sendiri harus diubah oleh administrator lain.',
        'CANNOT_DEMOTE_SELF',
      )
    }

    // Jangan sampai tidak tersisa satu pun administrator aktif.
    const mencabutAdmin =
      target.role === 'SUPERADMIN' &&
      (body.isActive === false || (body.role !== undefined && body.role !== 'SUPERADMIN'))

    if (mencabutAdmin) {
      const adminAktif = await db.user.count({
        where: { role: 'SUPERADMIN', isActive: true, id: { not: target.id } },
      })
      if (adminAktif === 0) {
        throw new HttpError(
          422,
          'Harus tersisa minimal satu administrator sistem yang aktif.',
          'LAST_SUPERADMIN',
        )
      }
    }

    const user = await db.user.update({
      where: { id },
      data: body,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        division: true,
        isActive: true,
      },
    })
    return ok(user)
  },
)
