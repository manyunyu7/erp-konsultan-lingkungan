'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserRoundCog } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { kirim } from '@/lib/kirim'
import { cn } from '@/lib/utils'

interface Akun {
  id: string
  name: string
  email: string
  role: string
  division: string
}

const LABEL_DIVISI: Record<string, string> = {
  MARKETING: 'Marketing & Tender',
  ADMIN_LEGAL: 'Admin & Legal',
  FINANCE: 'Keuangan',
  TEKNIS: 'Operasional Teknis',
  HR: 'Human Resources',
  MANAJEMEN: 'Manajemen',
}

const LABEL_PERAN: Record<string, string> = {
  DIREKTUR: 'Direktur',
  FINANCE_MANAGER: 'Finance Manager',
  PROJECT_MANAGER: 'Project Manager',
  STAFF: 'Staf',
}

/**
 * Pengalih akun untuk pengembangan.
 *
 * Endpoint di baliknya membalas 404 saat fitur mati, jadi komponen ini cukup
 * menyembunyikan dirinya sendiri bila daftar akun tidak dapat diambil —
 * tidak perlu menduplikasi pemeriksaan gerbangnya di sisi klien.
 */
export function PengalihAkun({
  tampilan,
  idAktif,
  daftarAwal,
}: {
  tampilan: 'panel' | 'ringkas'
  idAktif?: string
  /** Diisi bila pemanggilnya komponen server, agar tidak perlu mengambil ulang. */
  daftarAwal?: Akun[]
}) {
  const router = useRouter()
  const [akun, setAkun] = useState<Akun[] | null>(daftarAwal ?? null)
  const [memproses, setMemproses] = useState<string | null>(null)

  useEffect(() => {
    if (daftarAwal) return
    let batal = false
    fetch('/api/dev/accounts')
      .then((res) => (res.ok ? res.json() : null))
      .then((isi) => {
        if (!batal && isi?.data) setAkun(isi.data as Akun[])
      })
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [daftarAwal])

  if (!akun || akun.length === 0) return null

  async function pindah(id: string) {
    setMemproses(id)
    const hasil = await kirim('/api/dev/switch', 'POST', { userId: id })
    if (!hasil.ok) {
      setMemproses(null)
      return
    }
    if (tampilan === 'panel') router.replace('/')
    router.refresh()
    setMemproses(null)
  }

  if (tampilan === 'ringkas') {
    return (
      <label className="hidden items-center gap-2 sm:flex">
        <UserRoundCog className="size-4 text-muted-foreground" />
        <span className="sr-only">Ganti akun</span>
        <select
          value={idAktif ?? ''}
          onChange={(e) => pindah(e.target.value)}
          disabled={memproses !== null}
          className="h-8 max-w-56 rounded-md border bg-background px-2 text-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          {akun.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {LABEL_PERAN[a.role] ?? a.role}
            </option>
          ))}
        </select>
      </label>
    )
  }

  const perDivisi = akun.reduce<Record<string, Akun[]>>((kumpulan, a) => {
    ;(kumpulan[a.division] ??= []).push(a)
    return kumpulan
  }, {})

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <UserRoundCog className="size-4 text-muted-foreground" />
        <p className="text-xs font-medium">Masuk cepat (mode pengembangan)</p>
      </div>

      <div className="flex flex-col gap-3">
        {Object.entries(perDivisi).map(([divisi, daftar]) => (
          <div key={divisi}>
            <p className="mb-1.5 text-xs text-muted-foreground">
              {LABEL_DIVISI[divisi] ?? divisi}
            </p>
            <div className="flex flex-col gap-1.5">
              {daftar.map((a) => (
                <button
                  key={a.id}
                  onClick={() => pindah(a.id)}
                  disabled={memproses !== null}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition',
                    'hover:bg-accent hover:text-accent-foreground disabled:opacity-50',
                  )}
                >
                  <span className="min-w-0 truncate">{a.name}</span>
                  <Badge varian={a.role === 'STAFF' ? 'netral' : 'utama'}>
                    {LABEL_PERAN[a.role] ?? a.role}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Tanpa kata sandi. Hanya aktif di lingkungan pengembangan.
      </p>
    </div>
  )
}
