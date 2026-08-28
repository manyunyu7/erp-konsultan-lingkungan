import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { createBiddingCost } from '@/server/finance'

/** Nominal boleh dikirim sebagai angka atau string desimal; domain yang menormalkan. */
const skemaNominal = z.union([z.number(), z.string().min(1)])

const skema = z.object({
  tenderId: z.string().min(1, 'Tender wajib dipilih.'),
  category: z.string().min(1, 'Kategori biaya wajib dipilih.'),
  description: z.string().min(3, 'Uraian biaya wajib diisi.'),
  amount: skemaNominal,
  incurredAt: z.string().datetime({ offset: true }),
})

export const POST = route(async (request: Request) => {
  const actor = await requireActor('cost:write')

  const body = await readJson(request, (value) => {
    const hasil = skema.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Gate win rate 60% dan pembuatan dua baris persetujuan ada di lapisan domain.
  const cost = await createBiddingCost({
    tenderId: body.tenderId,
    category: body.category,
    description: body.description,
    amount: body.amount,
    incurredAt: new Date(body.incurredAt),
    requestedById: actor.id,
  })
  return ok(cost, 201)
})
