import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { BusinessRuleError, type Division, type Role } from '@/server/shared/constants'
import { normalizeEmail, validatePassword, type Actor } from './rules'
import { createSessionToken, type SessionPayload } from './session'

const BCRYPT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password)
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export interface LoginResult {
  token: string
  session: SessionPayload
}

/**
 * Pesan galat sengaja dibuat sama untuk email tidak dikenal maupun kata sandi
 * salah, agar tidak membocorkan email mana yang terdaftar.
 */
export async function login(
  email: string,
  password: string,
  now: Date,
): Promise<LoginResult> {
  const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } })
  const invalid = new BusinessRuleError('Email atau kata sandi salah.', 'INVALID_CREDENTIALS')
  if (!user) throw invalid
  if (!user.isActive) {
    throw new BusinessRuleError('Akun sudah dinonaktifkan.', 'ACCOUNT_INACTIVE')
  }
  const matches = await bcrypt.compare(password, user.passwordHash)
  if (!matches) throw invalid

  const session: SessionPayload = {
    userId: user.id,
    role: user.role as Role,
    division: user.division as Division,
    name: user.name,
  }
  return { token: await createSessionToken(session, now), session }
}

/** Memuat aktor lengkap dari database untuk pengecekan izin di lapisan API. */
export async function loadActor(userId: string): Promise<Actor> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new BusinessRuleError('Pengguna tidak ditemukan.', 'USER_NOT_FOUND')
  }
  return {
    id: user.id,
    role: user.role as Role,
    division: user.division as Division,
    isActive: user.isActive,
  }
}
