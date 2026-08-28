import { Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/** Pesan seragam ketika pengguna membuka halaman yang bukan haknya. */
export function AksesDitolak({ keterangan }: { keterangan?: string }) {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-2 text-center">
        <Lock className="size-5 text-muted-foreground" />
        <h1 className="text-sm font-medium">Halaman ini tidak terbuka untuk Anda</h1>
        <p className="text-sm text-muted-foreground">
          {keterangan ?? 'Silakan hubungi admin bila Anda merasa seharusnya punya akses.'}
        </p>
      </CardContent>
    </Card>
  )
}

export function Kosong({ pesan }: { pesan: string }) {
  return <p className="text-sm text-muted-foreground">{pesan}</p>
}
