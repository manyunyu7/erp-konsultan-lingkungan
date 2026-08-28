'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

export function Topbar({
  nama,
  peran,
  divisi,
}: {
  nama: string
  peran: string
  divisi: string
}) {
  const router = useRouter()

  async function keluar() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/masuk')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b bg-card px-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{nama}</p>
        <p className="truncate text-xs text-muted-foreground">
          {LABEL_PERAN[peran] ?? peran} · {LABEL_DIVISI[divisi] ?? divisi}
        </p>
      </div>
      <Button varian="halus" ukuran="sm" onClick={keluar}>
        <LogOut className="size-3.5" />
        Keluar
      </Button>
    </header>
  )
}
