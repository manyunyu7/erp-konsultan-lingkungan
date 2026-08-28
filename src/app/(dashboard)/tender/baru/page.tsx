import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { FormTender } from './form-tender'

export default async function HalamanTenderBaru() {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'tender:write')) notFound()

  const klien = await db.client.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-gap">
        <h1 className="text-lg font-semibold tracking-tight">Tender baru</h1>
        <p className="text-sm text-muted-foreground">
          Catat peluang tender yang akan diikuti beserta tenggat unggah dokumennya.
        </p>
      </div>
      <FormTender klien={klien} />
    </div>
  )
}
