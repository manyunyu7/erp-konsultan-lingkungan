import { redirect } from 'next/navigation'
import { currentActor, izinAktor } from '@/lib/api'
import { db } from '@/lib/db'
import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor()
  if (!actor) redirect('/masuk')

  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { name: true, role: true, division: true },
  })

  return (
    <div className="flex h-dvh">
      <Sidebar permissions={await izinAktor(actor)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          nama={user.name}
          peran={user.role}
          divisi={user.division}
          idPengguna={actor.id}
        />
        <main className="flex-1 overflow-y-auto p-pad">{children}</main>
      </div>
    </div>
  )
}
