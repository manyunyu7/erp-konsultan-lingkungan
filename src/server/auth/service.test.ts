import bcrypt from 'bcryptjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BusinessRuleError } from '@/server/shared/constants'

vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}))

import { db } from '@/lib/db'
import { hashPassword, loadActor, login } from './service'
import { readSessionToken } from './session'

const findUnique = vi.mocked(db.user.findUnique)
const NOW = new Date('2026-03-10T08:00:00.000Z')

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'budi@contoh.co.id',
    name: 'Budi',
    passwordHash: bcrypt.hashSync('rahasia123', 4),
    role: 'FINANCE_MANAGER',
    division: 'FINANCE',
    isActive: true,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AUTH_SECRET = 'rahasia-uji-yang-cukup-panjang'
})

describe('hashPassword', () => {
  it('menghasilkan hash yang cocok dengan kata sandi aslinya', async () => {
    const hash = await hashPassword('rahasia123')
    expect(hash).not.toBe('rahasia123')
    expect(await bcrypt.compare('rahasia123', hash)).toBe(true)
  })

  it('menolak kata sandi yang lemah sebelum sempat di-hash', async () => {
    await expect(hashPassword('abc')).rejects.toBeInstanceOf(BusinessRuleError)
  })
})

describe('login', () => {
  it('mengembalikan token sesi berisi peran dan divisi pengguna', async () => {
    findUnique.mockResolvedValue(userRow() as never)

    const hasil = await login('Budi@Contoh.co.id', 'rahasia123', NOW)

    // email dinormalkan sebelum pencarian
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'budi@contoh.co.id' } })
    expect(hasil.session).toEqual({
      userId: 'u1',
      role: 'FINANCE_MANAGER',
      division: 'FINANCE',
      name: 'Budi',
    })
    await expect(readSessionToken(hasil.token, NOW)).resolves.toEqual(hasil.session)
  })

  it('menolak email yang tidak terdaftar tanpa membocorkan penyebabnya', async () => {
    findUnique.mockResolvedValue(null as never)
    await expect(login('tidak@ada.co.id', 'rahasia123', NOW)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email atau kata sandi salah.',
    })
  })

  it('menolak kata sandi salah dengan pesan yang sama persis', async () => {
    findUnique.mockResolvedValue(userRow() as never)
    await expect(login('budi@contoh.co.id', 'salah123', NOW)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email atau kata sandi salah.',
    })
  })

  it('menolak akun yang sudah dinonaktifkan', async () => {
    findUnique.mockResolvedValue(userRow({ isActive: false }) as never)
    await expect(login('budi@contoh.co.id', 'rahasia123', NOW)).rejects.toMatchObject({
      code: 'ACCOUNT_INACTIVE',
    })
  })
})

describe('loadActor', () => {
  it('memuat aktor lengkap untuk pengecekan izin', async () => {
    findUnique.mockResolvedValue(userRow() as never)
    await expect(loadActor('u1')).resolves.toEqual({
      id: 'u1',
      role: 'FINANCE_MANAGER',
      division: 'FINANCE',
      isActive: true,
    })
  })

  it('melempar bila pengguna sudah tidak ada', async () => {
    findUnique.mockResolvedValue(null as never)
    await expect(loadActor('hilang')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
  })
})
