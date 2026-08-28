import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Kosong } from '@/components/ui/notice'
import { FormTermin } from './form-termin'

export default async function HalamanTerminBaru() {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'invoice:write')) notFound()

  // Rencana termijn dibuat sekali per proyek, jadi proyek yang sudah punya
  // rencana tidak perlu ditawarkan lagi.
  const proyek = await db.project.findMany({
    where: { termins: { none: {} } },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, contractValue: true },
  })

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-gap">
        <h1 className="text-lg font-semibold tracking-tight">Rencana termin</h1>
        <p className="text-sm text-muted-foreground">
          Bagi nilai kontrak menjadi tiga termin penagihan. Rencana hanya dapat dibuat sekali per
          proyek agar jejak auditnya utuh.
        </p>
      </div>
      {proyek.length === 0 ? (
        <Card>
          <CardContent>
            <Kosong pesan="Semua proyek sudah memiliki rencana termin." />
          </CardContent>
        </Card>
      ) : (
        <FormTermin
          proyek={proyek.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            contractValue: Number(p.contractValue),
          }))}
        />
      )}
    </div>
  )
}
