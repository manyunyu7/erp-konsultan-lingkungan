import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  readSessionToken,
  type SessionPayload,
} from './session'

const NOW = new Date('2026-03-10T08:00:00.000Z')

const payload: SessionPayload = {
  userId: 'u1',
  role: 'PROJECT_MANAGER',
  division: 'TEKNIS',
  name: 'Rina',
}

describe('token sesi', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'rahasia-uji-yang-cukup-panjang'
  })

  afterEach(() => {
    process.env.AUTH_SECRET = 'rahasia-uji-yang-cukup-panjang'
  })

  it('membuat token yang bisa dibaca kembali', async () => {
    const token = await createSessionToken(payload, NOW)
    await expect(readSessionToken(token, NOW)).resolves.toEqual(payload)
  })

  it('menolak token yang dirusak', async () => {
    const token = await createSessionToken(payload, NOW)
    await expect(readSessionToken(`${token}xyz`, NOW)).resolves.toBeNull()
  })

  it('menolak token yang sudah kedaluwarsa', async () => {
    const kemarin = new Date(NOW.getTime() - (SESSION_MAX_AGE + 60) * 1000)
    const token = await createSessionToken(payload, kemarin)
    await expect(readSessionToken(token, NOW)).resolves.toBeNull()
  })

  it('menolak token yang isinya tidak lengkap', async () => {
    const separuh = { ...payload, name: '' } as SessionPayload
    const token = await createSessionToken(separuh, NOW)
    await expect(readSessionToken(token, NOW)).resolves.toBeNull()
  })

  it('menolak bekerja bila AUTH_SECRET belum diatur', async () => {
    delete process.env.AUTH_SECRET
    await expect(createSessionToken(payload, NOW)).rejects.toBeInstanceOf(BusinessRuleError)
    await expect(readSessionToken('apa-saja', NOW)).resolves.toBeNull()
  })

  it('memakai nama cookie yang tetap', () => {
    expect(SESSION_COOKIE).toBe('erp_session')
  })
})
