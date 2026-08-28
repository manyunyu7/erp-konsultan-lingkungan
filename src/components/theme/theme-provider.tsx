'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Pengaturan tampilan yang bisa diubah pengguna saat aplikasi berjalan.
 *
 * Nilainya hanya ditempelkan sebagai atribut pada elemen <html>; seluruh
 * perubahan rupa terjadi lewat CSS variable di globals.css. Tidak ada komponen
 * yang perlu tahu soal tema — itu syarat supaya tampilan bisa diganti template
 * tanpa membongkar apa pun.
 */

export const COLOR_PRESETS = ['hutan', 'laut', 'tanah', 'netral'] as const
export type ColorPreset = (typeof COLOR_PRESETS)[number]

export const DENSITIES = ['rapat', 'normal', 'lega'] as const
export type Density = (typeof DENSITIES)[number]

export const MODES = ['terang', 'gelap', 'sistem'] as const
export type Mode = (typeof MODES)[number]

export interface ThemeSettings {
  preset: ColorPreset
  density: Density
  mode: Mode
  radius: number
}

export const DEFAULT_THEME: ThemeSettings = {
  preset: 'hutan',
  density: 'normal',
  mode: 'sistem',
  radius: 0.625,
}

const STORAGE_KEY = 'erp-tema'

interface ThemeContextValue {
  theme: ThemeSettings
  setTheme: (patch: Partial<ThemeSettings>) => void
  resetTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyToDocument(theme: ThemeSettings) {
  const root = document.documentElement
  root.dataset.preset = theme.preset
  root.dataset.density = theme.density
  root.style.setProperty('--radius-base', `${theme.radius}rem`)

  const gelap =
    theme.mode === 'gelap' ||
    (theme.mode === 'sistem' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', gelap)
}

/**
 * Membaca preferensi tersimpan. Dipanggil sebagai nilai awal state di klien,
 * bukan lewat effect, supaya tidak memicu render berantai.
 */
function bacaTersimpan(): ThemeSettings {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const tersimpan = window.localStorage.getItem(STORAGE_KEY)
    return tersimpan ? { ...DEFAULT_THEME, ...JSON.parse(tersimpan) } : DEFAULT_THEME
  } catch {
    // Preferensi tampilan bukan data penting — abaikan bila storage diblokir.
    return DEFAULT_THEME
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Nilai awal dibaca sekali saat komponen dibuat. Di server selalu bawaan;
  // di klien langsung memakai preferensi tersimpan, sama seperti yang sudah
  // diterapkan skrip pra-render pada elemen <html>, sehingga tidak ada kedipan.
  const [theme, setThemeState] = useState<ThemeSettings>(bacaTersimpan)

  useEffect(() => {
    applyToDocument(theme)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme))
    } catch {
      // sama seperti di atas
    }
  }, [theme])

  // Mengikuti perubahan tema sistem selama pengguna memilih mode "sistem".
  useEffect(() => {
    if (theme.mode !== 'sistem') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyToDocument(theme)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((patch: Partial<ThemeSettings>) => {
    setThemeState((sebelumnya) => ({ ...sebelumnya, ...patch }))
  }, [])

  const resetTheme = useCallback(() => setThemeState(DEFAULT_THEME), [])

  const value = useMemo(() => ({ theme, setTheme, resetTheme }), [theme, setTheme, resetTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme harus dipakai di dalam ThemeProvider.')
  return ctx
}
