import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme/theme-provider'
import './globals.css'

const sans = Inter({ variable: '--font-app-sans', subsets: ['latin'] })
const mono = JetBrains_Mono({ variable: '--font-app-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ERP Konsultan Lingkungan',
  description:
    'Sistem operasional konsultan lingkungan: tender, proyek, keuangan, HR, dan peringatan otomatis.',
}

/**
 * Menerapkan preferensi tampilan sebelum halaman tergambar, supaya pengguna
 * tidak melihat kedipan tema terang saat memilih mode gelap.
 */
const SKRIP_TEMA = `
(function () {
  try {
    var t = JSON.parse(localStorage.getItem('erp-tema') || '{}');
    var r = document.documentElement;
    r.dataset.preset = t.preset || 'hutan';
    r.dataset.density = t.density || 'normal';
    if (t.radius) r.style.setProperty('--radius-base', t.radius + 'rem');
    var mode = t.mode || 'sistem';
    var gelap = mode === 'gelap' || (mode === 'sistem' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    r.classList.toggle('dark', gelap);
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
