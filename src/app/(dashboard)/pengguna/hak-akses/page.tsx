import Link from 'next/link'
import { headers } from 'next/headers'
import { TriangleAlert } from 'lucide-react'
import { currentActor, izinkan } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { AksesDitolak } from '@/components/ui/notice'
import { GalatForm } from '@/components/ui/field'
import { MatriksAkses, type Isi } from './matriks-akses'

/**
 * Matriks dibaca lewat endpoint yang sama dengan yang dipakai antarmuka lain,
 * bukan langsung ke basis data, supaya tampilan tidak pernah melihat data yang
 * lebih longgar daripada yang dijaga API. Sesi diteruskan lewat header cookie.
 */
async function ambilMatriks(): Promise<{ isi?: Isi; galat?: string }> {
  const h = await headers()
  const asal = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
  let res: Response
  try {
    res = await fetch(`${asal}/api/permissions`, {
      headers: { cookie: h.get('cookie') ?? '' },
      cache: 'no-store',
    })
  } catch {
    return { galat: 'Tidak dapat menghubungi server saat memuat matriks hak akses.' }
  }
  const badan = await res.json().catch(() => null)
  if (!res.ok) return { galat: badan?.error?.message ?? 'Matriks hak akses gagal dimuat.' }
  return { isi: badan.data as Isi }
}

export default async function HalamanHakAkses() {
  const actor = await currentActor()
  if (!actor) return null
  if (!(await izinkan(actor, 'user:read'))) return <AksesDitolak />

  const bolehTulis = await izinkan(actor, 'user:write')
  const { isi, galat } = await ambilMatriks()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-gap">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Hak akses</h1>
        <p className="text-sm text-muted-foreground">
          Siapa boleh apa. Izin seseorang adalah gabungan izin perannya dan izin divisinya.{' '}
          <Link href="/pengguna" className="text-primary underline-offset-4 hover:underline">
            Kembali ke daftar pengguna
          </Link>
        </p>
      </div>

      {/* Peringatan jujur: perubahan di sini berlaku bagi orang lain, tidak
          seketika, dan bisa memutus pekerjaan yang sedang berjalan. */}
      <Card>
        <CardContent className="flex gap-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">Perubahan di halaman ini berlaku untuk semua orang.</p>
            <p className="text-muted-foreground">
              Matriks disimpan dalam singgahan selama 30 detik, jadi perubahan baru terasa
              merata paling lama sekitar setengah menit setelah disimpan — bukan seketika.
              Mencabut sebuah izin dapat membuat rekan kerja kehilangan akses ke pekerjaan yang
              sedang ia kerjakan, dan halamannya akan menolak terbuka tanpa penjelasan lain.
              {bolehTulis
                ? ' Periksa sekali lagi sebelum menyimpan.'
                : ' Anda hanya dapat melihat; penyuntingan butuh izin user:write.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <GalatForm pesan={galat ?? null} />
      {isi && <MatriksAkses isi={isi} bolehTulis={bolehTulis} />}
    </div>
  )
}
