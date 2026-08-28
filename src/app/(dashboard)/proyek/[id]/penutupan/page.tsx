import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, X } from 'lucide-react'
import { db } from '@/lib/db'
import { currentActor, izinkan } from '@/lib/api'
import { getClosureChecklist } from '@/server/lifecycle'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { tanggal } from '@/lib/utils'
import { PanelPenutupan } from './panel-penutupan'

/** Butir yang tidak terekam di basis data dikonfirmasi manual lewat parameter URL. */
const BUTIR_MANUAL = [
  { nama: 'jaminan', label: 'Jaminan pelaksanaan sudah dikembalikan' },
  { nama: 'laporan', label: 'Arsip laporan lengkap' },
  { nama: 'rawdata', label: 'Arsip raw data survey lengkap' },
  { nama: 'foto', label: 'Arsip foto rona awal lengkap' },
  { nama: 'peta', label: 'Arsip peta GIS lengkap' },
] as const

export default async function HalamanPenutupanProyek({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const q = await searchParams
  const actor = await currentActor()
  if (!actor) return null
  if (!await izinkan(actor, 'project:write')) notFound()

  const bolehCsat = await izinkan(actor, 'csat:write')
  const dicentang = (nama: string) => q[nama] === 'ya'

  const project = await db.project.findUnique({
    where: { id },
    include: { client: true, bast: true, csat: true },
  })
  if (!project) notFound()

  const checklist = await getClosureChecklist({
    projectId: project.id,
    performanceBondReturned: dicentang('jaminan'),
    archive: {
      reports: dicentang('laporan'),
      rawSurveyData: dicentang('rawdata'),
      baselinePhotos: dicentang('foto'),
      gisMaps: dicentang('peta'),
    },
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-gap">
      <div className="flex flex-col gap-1">
        <Link
          href={`/proyek/${project.id}`}
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke rincian proyek
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Penutupan proyek</h1>
        <p className="text-sm text-muted-foreground">
          {project.code} · {project.client.name}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Checklist penutupan</h2>
            <Badge varian={checklist.complete ? 'sukses' : 'peringatan'}>
              {checklist.complete ? 'Lengkap' : 'Belum lengkap'}
            </Badge>
          </div>

          <ul className="flex flex-col gap-1.5">
            {checklist.items.map((item) => (
              <li key={item.key} className="flex items-start gap-2 text-sm">
                {item.fulfilled ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={item.fulfilled ? '' : 'text-muted-foreground'}>{item.label}</span>
              </li>
            ))}
          </ul>

          {/* Konfirmasi manual dikirim ulang lewat URL supaya checklist tetap dihitung server. */}
          <form className="flex flex-col gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Tandai butir yang tidak terekam sistem, lalu perbarui checklist.
            </p>
            {BUTIR_MANUAL.map((b) => (
              <label key={b.nama} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={b.nama}
                  value="ya"
                  defaultChecked={dicentang(b.nama)}
                  className="size-4 accent-[var(--primary)]"
                />
                {b.label}
              </label>
            ))}
            <div className="flex justify-end">
              <Button type="submit" varian="garis" ukuran="sm">
                Perbarui checklist
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <PanelPenutupan
        projectId={project.id}
        bolehCsat={bolehCsat}
        bast={
          project.bast
            ? { number: project.bast.number, signedAt: tanggal(project.bast.signedAt) }
            : null
        }
        csatStatus={project.csat?.status ?? null}
      />
    </div>
  )
}
