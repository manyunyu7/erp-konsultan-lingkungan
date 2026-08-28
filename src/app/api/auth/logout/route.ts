import { cookies } from 'next/headers'
import { ok, route } from '@/lib/api'
import { SESSION_COOKIE } from '@/server/auth'

export const POST = route(async () => {
  ;(await cookies()).delete(SESSION_COOKIE)
  return ok({ keluar: true })
})
