import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'

/** Nama sertifikat mengikuti kode yang dipakai gate kelayakan penugasan. */
const NAMA_SERTIFIKAT = ['KTPA', 'ATPA', 'K3', 'AMBIL_SAMPEL', 'SKK', 'LAINNYA'] as const

const skemaSertifikat = z.object({
  personnelId: z.string().min(1, 'Personel wajib dipilih.'),
  name: z.enum(NAMA_SERTIFIKAT),
  issuer: z.string().min(2, 'Penerbit sertifikat wajib diisi.'),
  number: z.string().optional(),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
})

export const POST = route(async (request: Request) => {
  await requireActor('personnel:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaSertifikat.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  const issuedAt = new Date(body.issuedAt)
  const expiresAt = new Date(body.expiresAt)
  // Rentang terbalik bukan pelanggaran aturan bisnis, melainkan bentuk
  // permintaan yang mustahil — ditolak di sini sebagai galat validasi.
  if (expiresAt.getTime() <= issuedAt.getTime()) {
    throw new HttpError(
      400,
      'Tanggal kedaluwarsa harus setelah tanggal terbit.',
      'VALIDATION_ERROR',
    )
  }

  const personnel = await db.personnel.findUnique({ where: { id: body.personnelId } })
  if (!personnel) {
    throw new HttpError(404, 'Personel tidak ditemukan.', 'PERSONNEL_NOT_FOUND')
  }

  const certification = await db.certification.create({
    data: {
      personnelId: body.personnelId,
      name: body.name,
      issuer: body.issuer,
      number: body.number ?? null,
      issuedAt,
      expiresAt,
    },
  })
  return ok(certification, 201)
})
