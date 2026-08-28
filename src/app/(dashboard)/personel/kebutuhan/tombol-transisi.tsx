'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { GalatForm } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'

/**
 * Tombol transisi hanya menawarkan tujuan yang diberikan server; keabsahan
 * transisi tetap diputuskan lapisan domain saat permintaan dikirim.
 */
const TUJUAN = [
  { status: 'APPROVED', label: 'Setujui', varian: 'utama' },
  { status: 'REJECTED', label: 'Tolak', varian: 'bahaya' },
  { status: 'FULFILLED', label: 'Tandai terpenuhi', varian: 'halus' },
] as const

export function TombolTransisi({
  id,
  tersedia,
}: {
  id: string
  tersedia: readonly string[]
}) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState<string | null>(null)

  if (tersedia.length === 0) {
    return <span className="text-xs text-muted-foreground">Tidak ada tindakan lanjutan.</span>
  }

  async function ubah(status: string) {
    setMemproses(status)
    setGalat(null)
    const hasil = await kirim(`/api/manpower-requests/${id}`, 'PATCH', { status })
    setMemproses(null)
    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal mengubah status.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {TUJUAN.filter((t) => tersedia.includes(t.status)).map((t) => (
          <Button
            key={t.status}
            ukuran="sm"
            varian={t.varian}
            disabled={memproses !== null}
            onClick={() => ubah(t.status)}
          >
            {memproses === t.status ? 'Memproses…' : t.label}
          </Button>
        ))}
      </div>
      <GalatForm pesan={galat} />
    </div>
  )
}
