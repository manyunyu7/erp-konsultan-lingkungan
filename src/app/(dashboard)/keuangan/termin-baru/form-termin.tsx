'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'
import { rupiah } from '@/lib/utils'

interface ProyekRingkas {
  id: string
  code: string
  name: string
  contractValue: number
}

const TERMIN = [
  { label: 'Termin I', milestone: 'setelah kontrak/SPK ditandatangani', awal: '25' },
  { label: 'Termin II', milestone: 'setelah laporan draf diserahkan', awal: '45' },
  { label: 'Termin III', milestone: 'setelah BAST ditandatangani', awal: '30' },
]

export function FormTermin({ proyek }: { proyek: ProyekRingkas[] }) {
  const router = useRouter()
  const [proyekId, setProyekId] = useState('')
  const [persen, setPersen] = useState(TERMIN.map((t) => t.awal))
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  const terpilih = proyek.find((p) => p.id === proyekId)
  const angka = persen.map((p) => (p.trim() === '' ? 0 : Number(p)))
  const total = angka.reduce((n, p) => n + p, 0)

  function ubahPersen(index: number, nilai: string) {
    setPersen((sebelumnya) => sebelumnya.map((p, i) => (i === index ? nilai : p)))
  }

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const f = new FormData(e.currentTarget)
    const hasil = await kirim('/api/termins', 'POST', {
      projectId: proyekId,
      percentages: angka,
      plannedDates: TERMIN.map((_, i) =>
        new Date(String(f.get(`plannedDate${i}`))).toISOString(),
      ),
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menyimpan rencana termin.')
      setMemproses(false)
      return
    }

    router.push('/keuangan')
    router.refresh()
  }

  return (
    <form onSubmit={simpan}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field label="Proyek" wajib>
            <Select
              name="projectId"
              required
              value={proyekId}
              onChange={(e) => setProyekId(e.currentTarget.value)}
            >
              <option value="" disabled>
                — pilih proyek —
              </option>
              {proyek.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </Field>

          {terpilih && (
            <p className="text-xs text-muted-foreground">
              Nilai kontrak {rupiah(terpilih.contractValue)}.
            </p>
          )}

          {TERMIN.map((t, i) => (
            <div key={t.label} className="grid gap-4 sm:grid-cols-2">
              <Field
                label={`${t.label} (%)`}
                wajib
                hint={
                  terpilih
                    ? // Hitungan ini hanya bantuan visual; nominal resmi tetap
                      // dihitung ulang di server dari nilai kontrak.
                      `Perkiraan ${rupiah((terpilih.contractValue * angka[i]) / 100)} — ditagih ${t.milestone}`
                    : `Ditagih ${t.milestone}`
                }
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  required
                  value={persen[i]}
                  onChange={(e) => ubahPersen(i, e.currentTarget.value)}
                />
              </Field>
              <Field label={`Rencana tagih ${t.label}`} wajib>
                <Input name={`plannedDate${i}`} type="date" required />
              </Field>
            </div>
          ))}

          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Total saat ini {total.toLocaleString('id-ID')}%.{' '}
            {total === 100
              ? 'Pembagian sudah genap 100%.'
              : 'Total harus tepat 100% sebelum rencana dapat disimpan.'}{' '}
            Batas persentase tiap termin diperiksa ulang oleh server saat disimpan.
          </p>

          <GalatForm pesan={galat} />

          <div className="flex justify-end gap-2">
            <Button type="button" varian="garis" onClick={() => router.back()} disabled={memproses}>
              Batal
            </Button>
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menyimpan…' : 'Simpan rencana termin'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
