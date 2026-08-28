import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { Card, CardContent } from '@/components/ui/card'
import { FormProyek } from './form-proyek'

export default async function HalamanProyekBaru() {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'project:write')) notFound()

  // Hanya tender MENANG yang belum punya job order turunan yang bisa dikonversi.
  const tender = await db.tender.findMany({
    where: { status: 'WON', project: { is: null } },
    orderBy: { submissionDeadline: 'desc' },
    select: { id: true, code: true, title: true, client: { select: { name: true } } },
  })

  const jumlahMenang = await db.tender.count({ where: { status: 'WON' } })

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-gap flex flex-col gap-1">
        <Link
          href="/proyek"
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke daftar proyek
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Proyek baru</h1>
        <p className="text-sm text-muted-foreground">
          Job Order dibuat dari tender yang sudah dimenangkan. Nilai kontrak diambil otomatis
          dari harga penawaran tender.
        </p>
      </div>

      {tender.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Belum ada tender yang bisa dikonversi</h2>
            <p className="text-sm text-muted-foreground">
              {jumlahMenang === 0
                ? 'Belum ada tender berstatus Menang. Ubah dulu status tender menjadi Menang di halaman Tender setelah pengumuman pemenang keluar.'
                : `Seluruh tender yang menang (${jumlahMenang}) sudah memiliki proyek turunan. Satu tender hanya boleh menghasilkan satu Job Order.`}
            </p>
            <Link href="/tender" className="text-sm text-primary hover:underline">
              Buka daftar tender
            </Link>
          </CardContent>
        </Card>
      ) : (
        <FormProyek tender={tender} />
      )}
    </div>
  )
}
