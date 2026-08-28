'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Textarea } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'

/**
 * Peran penyetuju sengaja tidak dikirim dari sini — server membacanya dari sesi
 * supaya tampilan tidak pernah bisa menentukan atas nama siapa keputusan dicatat.
 */
export function KeputusanBiaya({ costEntryId }: { costEntryId: string }) {
  const router = useRouter()
  const [catatan, setCatatan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function putuskan(decision: 'APPROVED' | 'REJECTED') {
    setMemproses(true)
    setGalat(null)

    const hasil = await kirim(`/api/costs/${costEntryId}/approval`, 'PATCH', {
      decision,
      note: catatan.trim() === '' ? undefined : catatan.trim(),
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Keputusan gagal disimpan.')
      setMemproses(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <Field label="Catatan keputusan" hint="Wajib diisi bila menolak, agar pengaju tahu alasannya.">
        <Textarea
          value={catatan}
          onChange={(e) => setCatatan(e.currentTarget.value)}
          placeholder="Alasan menyetujui atau menolak…"
        />
      </Field>

      <GalatForm pesan={galat} />

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          varian="bahaya"
          disabled={memproses}
          onClick={() => putuskan('REJECTED')}
        >
          Tolak
        </Button>
        <Button type="button" disabled={memproses} onClick={() => putuskan('APPROVED')}>
          Setujui
        </Button>
      </div>
    </div>
  )
}
