import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { hashPassword } from '@/server/auth'

const skema = z.object({ password: z.string().min(1, 'Kata sandi wajib diisi.') })

/**
 * Menetapkan kata sandi baru untuk seorang pengguna.
 *
 * Sesi yang sudah berjalan tidak ikut diputus karena token bersifat mandiri;
 * pemilik akun tetap masuk sampai sesinya kedaluwarsa. Ini konsekuensi yang
 * diketahui, dan pantas dibenahi bila kelak akun dicabut karena penyalahgunaan.
 */
export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireActor('user:write')
    const { id } = await ctx.params

    const body = await readJson(request, (value) => {
      const hasil = skema.safeParse(value)
      if (!hasil.success) {
        throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
      }
      return hasil.data
    })

    if (!(await db.user.findUnique({ where: { id } }))) {
      throw new HttpError(404, 'Pengguna tidak ditemukan.', 'USER_NOT_FOUND')
    }

    await db.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(body.password) },
    })

    return ok({ diperbarui: true })
  },
)
