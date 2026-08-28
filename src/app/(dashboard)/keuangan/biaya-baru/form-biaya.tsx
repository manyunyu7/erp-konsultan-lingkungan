'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select, Textarea } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'

interface Pilihan {
  nilai: string
  label: string
}

interface TenderRingkas {
  id: string
  code: string
  title: string
  winRateProbability: number | null
}

interface ProyekRingkas {
  id: string
  code: string
  name: string
}

type Pola = 'BIDDING' | 'PROJECT'

const PENJELASAN_POLA: Record<Pola, string> = {
  BIDDING:
    'Biaya ini menempel pada tender, bukan pada proyek. Bila tender kalah, biaya ini hangus ' +
    'dan menjadi beban pemasaran — tidak bisa ditagihkan ke klien mana pun. Karena itu biaya ' +
    'tender hanya boleh diajukan untuk tender yang peluang menangnya wajar, dan harus disetujui ' +
    'Direktur dan Finance Manager sebelum dibayarkan.',
  PROJECT:
    'Biaya ini masuk harga pokok satu proyek yang kontraknya sudah ditandatangani, sehingga ' +
    'langsung mengurangi margin proyek tersebut. Proyek yang kontraknya belum diteken akan ' +
    'ditolak oleh sistem.',
}

export function FormBiaya({
  tender,
  proyek,
  kategoriTender,
  kategoriProyek,
}: {
  tender: TenderRingkas[]
  proyek: ProyekRingkas[]
  kategoriTender: Pilihan[]
  kategoriProyek: Pilihan[]
}) {
  const router = useRouter()
  const [pola, setPola] = useState<Pola>('BIDDING')
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  const kategori = pola === 'BIDDING' ? kategoriTender : kategoriProyek

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const f = new FormData(e.currentTarget)
    const acuan =
      pola === 'BIDDING'
        ? { tenderId: String(f.get('acuanId') ?? '') }
        : { projectId: String(f.get('acuanId') ?? '') }

    const hasil = await kirim<{ id: string }>(
      pola === 'BIDDING' ? '/api/costs/bidding' : '/api/costs/project',
      'POST',
      {
        ...acuan,
        category: String(f.get('category') ?? ''),
        description: String(f.get('description') ?? '').trim(),
        amount: Number(f.get('amount')),
        // Elemen date memberi tanggal tanpa zona; ubah ke ISO agar server
        // menerima titik waktu yang tidak ambigu.
        incurredAt: new Date(String(f.get('incurredAt'))).toISOString(),
      },
    )

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menyimpan.')
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
          <Field label="Pola biaya" wajib>
            <Select
              name="pattern"
              value={pola}
              onChange={(e) => setPola(e.currentTarget.value as Pola)}
            >
              <option value="BIDDING">Biaya tender (Pola 1)</option>
              <option value="PROJECT">Biaya proyek (Pola 2)</option>
            </Select>
          </Field>

          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {PENJELASAN_POLA[pola]}
          </p>

          {pola === 'BIDDING' ? (
            <Field
              label="Tender"
              wajib
              hint="Angka dalam kurung adalah probabilitas menang yang tercatat."
            >
              <Select name="acuanId" required defaultValue="">
                <option value="" disabled>
                  — pilih tender —
                </option>
                {tender.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.title} ({t.winRateProbability ?? 0}%)
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Proyek" wajib>
              <Select name="acuanId" required defaultValue="">
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
          )}

          <Field label="Kategori biaya" wajib>
            {/* Kunci `pola` memaksa pilihan kategori ikut tersetel ulang saat pola ditukar. */}
            <Select key={pola} name="category" required defaultValue="">
              <option value="" disabled>
                — pilih kategori —
              </option>
              {kategori.map((k) => (
                <option key={k.nilai} value={k.nilai}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nominal (Rp)" wajib>
              <Input name="amount" type="number" min={1} step={1000} required />
            </Field>
            <Field label="Tanggal pengeluaran" wajib>
              <Input name="incurredAt" type="date" required />
            </Field>
          </div>

          <Field label="Uraian" wajib>
            <Textarea
              name="description"
              required
              minLength={3}
              placeholder="Untuk apa biaya ini dikeluarkan…"
            />
          </Field>

          <GalatForm pesan={galat} />

          <div className="flex justify-end gap-2">
            <Button type="button" varian="garis" onClick={() => router.back()} disabled={memproses}>
              Batal
            </Button>
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menyimpan…' : 'Simpan biaya'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
