import { db } from '@/lib/db'
import { ok, requireActor, route } from '@/lib/api'
import { can } from '@/server/auth'

/**
 * Ringkasan beranda. Isinya menyesuaikan izin pemanggil — angka keuangan tidak
 * ikut terkirim kepada pengguna yang memang tidak berhak melihatnya.
 */
export const GET = route(async () => {
  const actor = await requireActor()
  const now = new Date()

  const [tenderAktif, proyekBerjalan, tenggatDekat, peringatan] = await Promise.all([
    db.tender.count({ where: { status: { in: ['IDENTIFIED', 'PREPARING', 'SUBMITTED'] } } }),
    db.project.count({ where: { status: { in: ['PREPARATION', 'RUNNING', 'REPORTING'] } } }),
    db.deliverable.count({
      where: {
        status: { notIn: ['APPROVED'] },
        dueDate: { lte: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) },
      },
    }),
    db.notificationRecipient.count({ where: { userId: actor.id, readAt: null } }),
  ])

  const ringkasan: Record<string, unknown> = {
    tenderAktif,
    proyekBerjalan,
    tenggatDekat,
    peringatanBelumDibaca: peringatan,
  }

  if (can(actor, 'invoice:read')) {
    const [belumLunas, jatuhTempo] = await Promise.all([
      db.invoice.count({ where: { paidAt: null, status: { notIn: ['CANCELLED'] } } }),
      db.invoice.count({
        where: { paidAt: null, dueDate: { lt: now }, status: { notIn: ['CANCELLED'] } },
      }),
    ])
    ringkasan.invoiceBelumLunas = belumLunas
    ringkasan.invoiceJatuhTempo = jatuhTempo
  }

  if (can(actor, 'personnel:read')) {
    const ambangH60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    ringkasan.sertifikatSegeraHabis = await db.certification.count({
      where: { expiresAt: { gte: now, lte: ambangH60 } },
    })
  }

  return ok(ringkasan)
})
