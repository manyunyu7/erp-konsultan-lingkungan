import { db } from '@/lib/db'
import { pengalihAkunAktif } from '@/lib/dev'
import { PengalihAkun } from '@/components/dev/pengalih-akun'
import { FormMasuk } from './form-masuk'

export default async function HalamanMasuk() {
  // Daftar akun disiapkan di server agar panel langsung tampak tanpa menunggu
  // permintaan tambahan; saat fitur mati, daftarnya memang tidak pernah dibuat.
  const akun = pengalihAkunAktif()
    ? await db.user.findMany({
        where: { isActive: true },
        orderBy: [{ division: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, email: true, role: true, division: true },
      })
    : []

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <FormMasuk />
        {akun.length > 0 && <PengalihAkun tampilan="panel" daftarAwal={akun} />}
      </div>
    </div>
  )
}
