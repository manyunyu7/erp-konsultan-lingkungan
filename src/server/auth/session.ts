import { SignJWT, jwtVerify } from 'jose'
import { BusinessRuleError, type Division, type Role } from '@/server/shared/constants'

export interface SessionPayload {
  userId: string
  role: Role
  division: Division
  name: string
}

const ALGORITHM = 'HS256'
const SESSION_TTL_SECONDS = 60 * 60 * 8 // satu hari kerja

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new BusinessRuleError('AUTH_SECRET belum diatur.', 'MISSING_AUTH_SECRET')
  }
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(
  payload: SessionPayload,
  now: Date,
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000)
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(secretKey())
}

/**
 * Mengembalikan null bila token tidak valid/kedaluwarsa, bukan melempar.
 * `now` bisa diisi agar pemeriksaan masa berlaku dapat diuji secara pasti.
 */
export async function readSessionToken(
  token: string,
  now?: Date,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: [ALGORITHM],
      currentDate: now,
    })
    const { userId, role, division, name } = payload as unknown as SessionPayload
    if (!userId || !role || !division || !name) return null
    return { userId, role, division, name }
  } catch {
    return null
  }
}

export const SESSION_COOKIE = 'erp_session'
export const SESSION_MAX_AGE = SESSION_TTL_SECONDS
