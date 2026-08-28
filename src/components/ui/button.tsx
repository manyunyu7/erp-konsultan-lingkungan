import { cn } from '@/lib/utils'

const VARIAN = {
  utama: 'bg-primary text-primary-foreground hover:opacity-90',
  garis: 'border bg-transparent hover:bg-accent hover:text-accent-foreground',
  halus: 'bg-secondary text-secondary-foreground hover:bg-accent',
  bahaya: 'bg-destructive text-destructive-foreground hover:opacity-90',
} as const

const UKURAN = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
} as const

export function Button({
  varian = 'utama',
  ukuran = 'md',
  className,
  ...props
}: React.ComponentProps<'button'> & {
  varian?: keyof typeof VARIAN
  ukuran?: keyof typeof UKURAN
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIAN[varian],
        UKURAN[ukuran],
        className,
      )}
      {...props}
    />
  )
}
