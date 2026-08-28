import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Kosong } from '@/components/ui/notice'
import { LABEL_MILESTONE_TERMIN } from '../labels'
import { FormInvoice } from './form-invoice'

export default async function HalamanInvoiceBaru() {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'invoice:write')) notFound()

  // Termin yang sudah punya invoice tidak boleh ditagih dua kali.
  const termins = await db.termin.findMany({
    where: { invoice: null },
    orderBy: [{ project: { code: 'asc' } }, { sequence: 'asc' }],
    include: { project: { select: { code: true, name: true } } },
  })

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-gap">
        <h1 className="text-lg font-semibold tracking-tight">Terbitkan invoice</h1>
        <p className="text-sm text-muted-foreground">
          Invoice tidak dapat terbit sebelum BAP terverifikasi dan milestone termin tercapai.
        </p>
      </div>
      {termins.length === 0 ? (
        <Card>
          <CardContent>
            <Kosong pesan="Tidak ada termin yang menunggu penagihan." />
          </CardContent>
        </Card>
      ) : (
        <FormInvoice
          termins={termins.map((t) => ({
            id: t.id,
            label: `${t.project.code} — ${t.name} (${LABEL_MILESTONE_TERMIN[t.milestone] ?? t.milestone})`,
            amount: Number(t.amount),
            milestoneMet: t.milestoneMetAt !== null,
          }))}
        />
      )}
    </div>
  )
}
