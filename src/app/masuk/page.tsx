'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function HalamanMasuk() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (res.ok) {
      router.replace('/')
      router.refresh()
      return
    }

    const isi = await res.json().catch(() => null)
    setGalat(isi?.error?.message ?? 'Tidak dapat masuk. Coba lagi.')
    setMemproses(false)
  }

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            EL
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">ERP Konsultan Lingkungan</h1>
            <p className="text-xs text-muted-foreground">Sistem operasional internal</p>
          </div>
        </div>

        <form onSubmit={kirim} className="rounded-lg border bg-card p-pad">
          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-medium">Kata sandi</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            />
          </label>

          {galat && (
            <p
              role="alert"
              className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {galat}
            </p>
          )}

          <Button type="submit" disabled={memproses} className="w-full">
            {memproses ? 'Memeriksa…' : 'Masuk'}
          </Button>
        </form>
      </div>
    </div>
  )
}
