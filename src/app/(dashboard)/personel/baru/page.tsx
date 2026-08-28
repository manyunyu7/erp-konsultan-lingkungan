import { notFound } from 'next/navigation'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { FormPersonel } from './form-personel'

export default async function HalamanPersonelBaru() {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'personnel:write')) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-gap">
        <h1 className="text-lg font-semibold tracking-tight">Personel baru</h1>
        <p className="text-sm text-muted-foreground">
          Catat data dasar personel. Sertifikat dan penilaian KPI ditambahkan dari halaman
          rinciannya.
        </p>
      </div>
      <FormPersonel />
    </div>
  )
}
