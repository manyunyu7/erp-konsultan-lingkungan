import { cn } from '@/lib/utils'

/**
 * Kolom isian dasar. Sengaja tipis dan tanpa pustaka formulir: seluruh isian
 * memakai elemen HTML asli, sehingga template pengganti bisa menukar tampilan
 * ini tanpa perlu ikut memakai pustaka yang sama.
 */

const KELAS_ISIAN =
  'h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ' +
  'disabled:opacity-50'

export function Field({
  label,
  hint,
  error,
  wajib,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  wajib?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-medium">
        {label}
        {wajib && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-destructive">
          {error}
        </span>
      )}
    </label>
  )
}

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(KELAS_ISIAN, className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(KELAS_ISIAN, 'h-auto min-h-20 py-2', className)} {...props} />
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn(KELAS_ISIAN, className)} {...props} />
}

/** Ringkasan galat dari server, ditampilkan di atas tombol kirim. */
export function GalatForm({ pesan }: { pesan: string | null }) {
  if (!pesan) return null
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {pesan}
    </p>
  )
}
