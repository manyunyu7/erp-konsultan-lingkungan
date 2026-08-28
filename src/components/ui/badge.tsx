import { cn } from '@/lib/utils'

const VARIAN = {
  netral: 'bg-secondary text-secondary-foreground',
  utama: 'bg-primary/10 text-primary',
  sukses: 'bg-[var(--success)]/12 text-[var(--success)]',
  peringatan: 'bg-[var(--warning)]/15 text-[var(--warning)]',
  bahaya: 'bg-destructive/12 text-destructive',
  info: 'bg-[var(--info)]/12 text-[var(--info)]',
} as const

export type VarianBadge = keyof typeof VARIAN

export function Badge({
  varian = 'netral',
  className,
  ...props
}: React.ComponentProps<'span'> & { varian?: VarianBadge }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        VARIAN[varian],
        className,
      )}
      {...props}
    />
  )
}
