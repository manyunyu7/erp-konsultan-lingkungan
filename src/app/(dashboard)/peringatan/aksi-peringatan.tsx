'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { kirim } from '@/lib/kirim'

/** Menandai satu peringatan milik pengguna ini sebagai sudah dibaca. */
export function TombolTandaiDibaca({ notificationId }: { notificationId: string }) {
  const router = useRouter()
  const [memproses, setMemproses] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function tandai() {
    setMemproses(true)
    setGalat(null)
    const hasil = await kirim(`/api/notifications/${notificationId}/dibaca`, 'PATCH')
    setMemproses(false)
    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menandai peringatan.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <Button varian="garis" ukuran="sm" onClick={tandai} disabled={memproses}>
        {memproses ? 'Menandai…' : 'Tandai sudah dibaca'}
      </Button>
      {galat && (
        <span role="alert" className="text-xs text-destructive">
          {galat}
        </span>
      )}
    </div>
  )
}

/** Menjalankan pemindaian peringatan atas permintaan pengguna. */
export function TombolPindai() {
  const router = useRouter()
  const [memproses, setMemproses] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  async function pindai() {
    setMemproses(true)
    setPesan(null)
    setGalat(null)
    const hasil = await kirim<{ created: number; sent: number; skipped: number }>(
      '/api/notifications/scan',
      'POST',
    )
    setMemproses(false)
    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Pemindaian gagal.')
      return
    }
    const d = hasil.data
    setPesan(
      `${d?.created ?? 0} peringatan baru, ${d?.sent ?? 0} terkirim, ${d?.skipped ?? 0} sudah ada.`,
    )
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button varian="halus" ukuran="sm" onClick={pindai} disabled={memproses}>
        {memproses ? 'Memeriksa…' : 'Periksa peringatan sekarang'}
      </Button>
      {pesan && <span className="text-xs text-muted-foreground">{pesan}</span>}
      {galat && (
        <span role="alert" className="text-xs text-destructive">
          {galat}
        </span>
      )}
    </div>
  )
}
