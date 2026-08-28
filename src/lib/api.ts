import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  SESSION_COOKIE,
  assertCan,
  loadActor,
  readSessionToken,
  type Actor,
  type Permission,
} from '@/server/auth'

/**
 * Jembatan tipis antara HTTP dan lapisan aturan bisnis.
 *
 * Semua penerjemahan galat terpusat di sini supaya setiap route handler tetap
 * pendek, dan supaya antarmuka pengganti (template beli) menghadapi bentuk
 * balasan yang selalu sama.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
  ) {
    super(message)
  }
}

/** Kode aturan bisnis yang punya arti HTTP khusus. */
const STATUS_BY_CODE: Record<string, number> = {
  FORBIDDEN: 403,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_INACTIVE: 403,
  USER_NOT_FOUND: 404,
}

export async function currentActor(): Promise<Actor | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await readSessionToken(token, new Date())
  if (!session) return null
  try {
    return await loadActor(session.userId)
  } catch {
    return null
  }
}

/** Memastikan pemanggil sudah masuk dan memiliki izin yang diminta. */
export async function requireActor(permission?: Permission): Promise<Actor> {
  const actor = await currentActor()
  if (!actor) throw new HttpError(401, 'Silakan masuk terlebih dahulu.', 'UNAUTHENTICATED')
  if (permission) assertCan(actor, permission)
  return actor
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function fail(status: number, message: string, code: string) {
  return NextResponse.json({ error: { message, code } }, { status })
}

/**
 * Membungkus route handler agar galat aturan bisnis menjadi balasan HTTP yang
 * rapi, bukan jejak tumpukan.
 */
export function route<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof HttpError) return fail(error.status, error.message, error.code)
      if (error instanceof BusinessRuleError) {
        // 422: permintaannya sah secara bentuk, tetapi melanggar aturan bisnis.
        return fail(STATUS_BY_CODE[error.code] ?? 422, error.message, error.code)
      }
      console.error(error)
      return fail(500, 'Terjadi kesalahan pada sistem.', 'INTERNAL_ERROR')
    }
  }
}

/** Membaca dan memvalidasi badan permintaan JSON. */
export async function readJson<T>(request: Request, parse: (value: unknown) => T): Promise<T> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new HttpError(400, 'Badan permintaan bukan JSON yang sah.', 'INVALID_JSON')
  }
  return parse(raw)
}
