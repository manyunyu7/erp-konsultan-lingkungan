import { db } from '@/lib/db'
import { HttpError, ok, route } from '@/lib/api'
import { pengalihAkunAktif } from '@/lib/dev'

/**
 * Daftar akun untuk pengalih akun saat pengembangan.
 * Membalas 404 bila fitur mati, sehingga keberadaannya pun tidak terbaca.
 */
export const GET = route(async () => {
  if (!pengalihAkunAktif()) {
    // 404, bukan 403: keberadaan fitur ini pun tidak perlu terbaca.
    throw new HttpError(404, 'Tidak ditemukan.', 'NOT_FOUND')
  }

  const users = await db.user.findMany({
    where: { isActive: true },
    orderBy: [{ division: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, email: true, role: true, division: true },
  })
  return ok(users)
})
