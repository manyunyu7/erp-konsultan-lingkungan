import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { Kosong } from '@/components/ui/notice'
import { tanggal } from '@/lib/utils'
import { FormKontrak } from './form-kontrak'

const KONTRAK_TIPE_LABEL: Record<string, string> = {
  SPK: 'SPK',
  LOA: 'LOA',
  PKS: 'PKS',
  ADDENDUM: 'Addendum',
}

export default async function HalamanKontrakProyek({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'contract:write')) notFound()

  const project = await db.project.findUnique({
    where: { id },
    include: { client: true, contracts: { orderBy: { signedAt: 'asc' } } },
  })
  if (!project) notFound()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-gap">
      <div className="flex flex-col gap-1">
        <Link
          href={`/proyek/${project.id}`}
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke rincian proyek
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Dokumen kontrak</h1>
        <p className="text-sm text-muted-foreground">
          {project.code} · {project.client.name}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Kontrak yang sudah tercatat</h2>
          {project.contracts.length === 0 ? (
            <Kosong pesan="Belum ada dokumen kontrak tercatat. Proyek belum boleh berjalan sebelum ada SPK/LOA/PKS yang diteken." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Jenis</TH>
                  <TH>Nomor</TH>
                  <TH>Diteken</TH>
                  <TH>Berlaku sampai</TH>
                </TR>
              </THead>
              <tbody>
                {project.contracts.map((c) => (
                  <TR key={c.id}>
                    <TD>{KONTRAK_TIPE_LABEL[c.type] ?? c.type}</TD>
                    <TD className="font-medium">{c.number}</TD>
                    <TD className="whitespace-nowrap">{tanggal(c.signedAt)}</TD>
                    <TD className="whitespace-nowrap">{tanggal(c.validUntil)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FormKontrak projectId={project.id} />
    </div>
  )
}
