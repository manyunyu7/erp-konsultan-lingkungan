'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  COLOR_PRESETS,
  DENSITIES,
  MODES,
  useTheme,
  type ColorPreset,
  type Density,
  type Mode,
} from '@/components/theme/theme-provider'
import { cn } from '@/lib/utils'

const LABEL_PRESET: Record<ColorPreset, string> = {
  hutan: 'Hutan',
  laut: 'Laut',
  tanah: 'Tanah',
  netral: 'Netral',
}

const LABEL_MODE: Record<Mode, string> = {
  terang: 'Terang',
  gelap: 'Gelap',
  sistem: 'Ikut sistem',
}

const LABEL_DENSITY: Record<Density, string> = {
  rapat: 'Rapat',
  normal: 'Normal',
  lega: 'Lega',
}

export default function HalamanTampilan() {
  const { theme, setTheme, resetTheme } = useTheme()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-gap">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Tampilan</h1>
        <p className="text-sm text-muted-foreground">
          Pengaturan disimpan di peramban masing-masing pengguna dan berlaku seketika.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Judul>Warna utama</Judul>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setTheme({ preset })}
                data-preset={preset}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition',
                  theme.preset === preset
                    ? 'border-[var(--primary)] bg-primary/5'
                    : 'hover:bg-accent',
                )}
              >
                <span className="size-4 rounded-full bg-[var(--primary)]" />
                {LABEL_PRESET[preset]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Judul>Mode terang / gelap</Judul>
          <div className="flex flex-wrap gap-2">
            {MODES.map((mode) => (
              <Button
                key={mode}
                varian={theme.mode === mode ? 'utama' : 'garis'}
                ukuran="sm"
                onClick={() => setTheme({ mode })}
              >
                {LABEL_MODE[mode]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Judul>Kerapatan tampilan</Judul>
          <div className="flex flex-wrap gap-2">
            {DENSITIES.map((density) => (
              <Button
                key={density}
                varian={theme.density === density ? 'utama' : 'garis'}
                ukuran="sm"
                onClick={() => setTheme({ density })}
              >
                {LABEL_DENSITY[density]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Mengubah jarak antar elemen tanpa mengubah ukuran huruf.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Judul>Sudut membulat</Judul>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.125}
            value={theme.radius}
            onChange={(e) => setTheme({ radius: Number(e.target.value) })}
            className="w-full accent-[var(--primary)]"
            aria-label="Sudut membulat"
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {theme.radius.toFixed(3)} rem
            </span>
            <div className="h-8 w-16 rounded-lg bg-primary/15" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Judul>Pratinjau</Judul>
          <div className="flex flex-wrap items-center gap-2">
            <Button ukuran="sm">Tombol utama</Button>
            <Button varian="garis" ukuran="sm">
              Tombol garis
            </Button>
            <Badge varian="sukses">Lunas</Badge>
            <Badge varian="peringatan">H-3</Badge>
            <Badge varian="bahaya">Lewat jatuh tempo</Badge>
            <Badge varian="info">Menunggu QC</Badge>
          </div>
          <div className="flex justify-end">
            <Button varian="halus" ukuran="sm" onClick={resetTheme}>
              Kembalikan ke bawaan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Judul({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-medium">{children}</h2>
}
