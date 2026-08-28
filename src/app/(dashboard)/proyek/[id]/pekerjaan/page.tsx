import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { currentActor, izinkan } from '@/lib/api'
import { collectApprovedStages } from '@/server/lifecycle'
import { PanelLampiran } from '@/components/lampiran/panel-lampiran'
import { PanelPekerjaan } from './panel-pekerjaan'

export default async function HalamanPekerjaanProyek({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await currentActor()
  if (!actor) return null
  if (!await izinkan(actor, 'deliverable:write')) notFound()

  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      deliverables: { orderBy: { dueDate: 'asc' } },
      labSamples: { orderBy: { takenAt: 'asc' } },
    },
  })
  if (!project) notFound()

  // Petunjuk tahap yang siap dimulai dihitung oleh domain; klien hanya memberi aba-aba.
  const approvedStages = await collectApprovedStages(project.id)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-gap">
      <div className="flex flex-col gap-1">
        <Link
          href={`/proyek/${project.id}`}
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke rincian proyek
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Tahapan teknis</h1>
        <p className="text-sm text-muted-foreground">
          {project.code} · {project.client.name}
        </p>
      </div>

      <PanelPekerjaan
        projectId={project.id}
        approvedStages={approvedStages}
        deliverables={project.deliverables.map((d) => ({
          id: d.id,
          type: d.type,
          name: d.name,
          status: d.status,
          dueDate: d.dueDate.toISOString(),
        }))}
        samples={project.labSamples.map((s) => ({
          id: s.id,
          sampleCode: s.sampleCode,
          matrix: s.matrix,
          location: s.location,
          laboratory: s.laboratory,
          cocNumber: s.cocNumber,
          status: s.status,
          takenAt: s.takenAt.toISOString(),
        }))}
      />

      <PanelLampiran
        entityType="Project"
        entityId={project.id}
        judul="Foto lapangan & dokumen teknis"
      />

      {project.deliverables.map((d) => (
        <PanelLampiran
          key={d.id}
          entityType="Deliverable"
          entityId={d.id}
          judul={`Lampiran tahap: ${d.name}`}
        />
      ))}
    </div>
  )
}
