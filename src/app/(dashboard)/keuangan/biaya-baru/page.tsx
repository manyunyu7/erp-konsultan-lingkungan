import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { currentActor, izinkan } from '@/lib/api'
import { BIDDING_COST_CATEGORIES, PROJECT_COST_CATEGORIES } from '@/server/finance'
import { FormBiaya } from './form-biaya'
import { LABEL_KATEGORI_BIAYA } from '../labels'

export default async function HalamanBiayaBaru() {
  const actor = await currentActor()
  if (!actor) return null
  if (!await izinkan(actor, 'cost:write')) notFound()

  const [tender, proyek] = await Promise.all([
    db.tender.findMany({
      orderBy: { submissionDeadline: 'asc' },
      select: { id: true, code: true, title: true, winRateProbability: true },
    }),
    db.project.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
  ])

  const kategori = (daftar: readonly string[]) =>
    daftar.map((nilai) => ({ nilai, label: LABEL_KATEGORI_BIAYA[nilai] ?? nilai }))

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-gap">
        <h1 className="text-lg font-semibold tracking-tight">Biaya baru</h1>
        <p className="text-sm text-muted-foreground">
          Catat pengeluaran dan pilih polanya. Pola menentukan ke mana biaya ini dibebankan.
        </p>
      </div>
      <FormBiaya
        tender={tender}
        proyek={proyek}
        kategoriTender={kategori(BIDDING_COST_CATEGORIES)}
        kategoriProyek={kategori(PROJECT_COST_CATEGORIES)}
      />
    </div>
  )
}
