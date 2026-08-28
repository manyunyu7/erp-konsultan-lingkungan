import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Memformat angka rupiah tanpa desimal — nominal proyek selalu bulat. */
export function rupiah(nilai: number | string | null | undefined): string {
  if (nilai === null || nilai === undefined) return '—'
  const angka = typeof nilai === 'string' ? Number(nilai) : nilai
  if (!Number.isFinite(angka)) return '—'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(angka)
}

export function tanggal(nilai: Date | string | null | undefined): string {
  if (!nilai) return '—'
  const d = typeof nilai === 'string' ? new Date(nilai) : nilai
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(d)
}

/** Selisih hari menuju tanggal target, dihitung pada zona WIB. */
export function sisaHari(target: Date | string, sekarang: Date = new Date()): number {
  const t = typeof target === 'string' ? new Date(target) : target
  const HARI = 86_400_000
  const wib = (d: Date) => Math.floor((d.getTime() + 7 * 3_600_000) / HARI)
  return wib(t) - wib(sekarang)
}
