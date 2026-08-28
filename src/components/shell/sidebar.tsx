'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  FolderKanban,
  Gavel,
  LayoutDashboard,
  Palette,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { NAV_ITEMS } from './nav-items'
import { cn } from '@/lib/utils'

const IKON: Record<string, LucideIcon> = {
  LayoutDashboard,
  Gavel,
  FolderKanban,
  Wallet,
  Users,
  Bell,
  Palette,
}

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname()
  const menu = NAV_ITEMS.filter((i) => !i.permission || permissions.includes(i.permission))

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
          EL
        </div>
        <span className="text-sm font-semibold tracking-tight">ERP Lingkungan</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {menu.map((item) => {
          const Ikon = IKON[item.icon]
          const aktif = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition',
                aktif
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Ikon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
