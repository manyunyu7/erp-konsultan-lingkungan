import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { issueInvoice } from '@/server/finance'

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

const skema = z.object({
  terminId: z.string().min(1, 'Termin wajib dipilih.'),
  number: z.string().min(3, 'Nomor invoice wajib diisi.'),
  bapNumber: z.string().min(1, 'Nomor BAP wajib diisi.'),
  bapVerifiedAt: z.string().datetime({ offset: true }).nullable().optional(),
  taxInvoiceNo: z.string().optional(),
  issuedAt: z.string().datetime({ offset: true }),
  dueDate: z.string().datetime({ offset: true }),
})

export const POST = route(async (request: Request) => {
  await requireActor('invoice:write')

  const body = await readJson(request, (value) => {
    const hasil = skema.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Gate BAP terverifikasi dan milestone termin dijaga di lapisan domain.
  const invoice = await issueInvoice({
    terminId: body.terminId,
    number: body.number,
    bapNumber: body.bapNumber,
    bapVerifiedAt: body.bapVerifiedAt ? new Date(body.bapVerifiedAt) : null,
    issuedAt: new Date(body.issuedAt),
    dueDate: new Date(body.dueDate),
  })

  // Nomor faktur pajak hanya data pelengkap administratif, tidak ikut jadi gate
  // penerbitan, sehingga disimpan setelah domain menyatakan invoice boleh terbit.
  if (body.taxInvoiceNo) {
    return ok(
      await db.invoice.update({
        where: { id: invoice.id },
        data: { taxInvoiceNo: body.taxInvoiceNo },
      }),
      201,
    )
  }
  return ok(invoice, 201)
})
