import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MATRIX } from '@/server/auth/rules'

vi.mock('@/lib/db', () => ({
  db: {
    permissionGrant: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import {
  invalidateMatrixCache,
  listGrants,
  loadMatrix,
  replaceGrants,
  seedDefaultsIfEmpty,
} from './service'

const findMany = vi.mocked(db.permissionGrant.findMany)
const count = vi.mocked(db.permissionGrant.count)
const createMany = vi.mocked(db.permissionGrant.createMany)
const transaction = vi.mocked(db.$transaction)

const NOW = new Date('2026-05-05T03:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  invalidateMatrixCache()
})

describe('loadMatrix', () => {
  it('memakai matriks bawaan bila belum ada suntingan tersimpan', async () => {
    findMany.mockResolvedValue([] as never)
    await expect(loadMatrix(NOW)).resolves.toBe(DEFAULT_MATRIX)
  })

  it('menyusun matriks dari basis data', async () => {
    findMany.mockResolvedValue([
      { subjectType: 'ROLE', subject: 'STAFF', permission: 'tender:read' },
    ] as never)

    const matrix = await loadMatrix(NOW)
    expect(matrix.roles.STAFF).toEqual(['tender:read'])
  })

  it('menyinggahkan hasil agar tidak menambah kueri pada tiap permintaan', async () => {
    findMany.mockResolvedValue([] as never)

    await loadMatrix(NOW)
    await loadMatrix(new Date(NOW.getTime() + 1_000))

    expect(findMany).toHaveBeenCalledTimes(1)
  })

  it('membaca ulang setelah umur singgahan lewat', async () => {
    findMany.mockResolvedValue([] as never)

    await loadMatrix(NOW)
    await loadMatrix(new Date(NOW.getTime() + 31_000))

    expect(findMany).toHaveBeenCalledTimes(2)
  })

  it('membaca ulang setelah singgahan dibuang', async () => {
    findMany.mockResolvedValue([] as never)

    await loadMatrix(NOW)
    invalidateMatrixCache()
    await loadMatrix(NOW)

    expect(findMany).toHaveBeenCalledTimes(2)
  })

  it('memakai waktu berjalan bila tidak diberi acuan', async () => {
    findMany.mockResolvedValue([] as never)
    await expect(loadMatrix()).resolves.toBe(DEFAULT_MATRIX)
  })
})

describe('listGrants', () => {
  it('mengembalikan seluruh pemberian izin terurut', async () => {
    const baris = [{ subjectType: 'ROLE', subject: 'STAFF', permission: 'tender:read' }]
    findMany.mockResolvedValue(baris as never)

    await expect(listGrants()).resolves.toEqual(baris)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ subjectType: 'asc' }, { subject: 'asc' }, { permission: 'asc' }],
      }),
    )
  })
})

describe('seedDefaultsIfEmpty', () => {
  it('mengisi matriks bawaan saat tabel masih kosong', async () => {
    count.mockResolvedValue(0 as never)
    createMany.mockResolvedValue({ count: 1 } as never)

    const jumlah = await seedDefaultsIfEmpty()

    expect(jumlah).toBeGreaterThan(0)
    expect(createMany).toHaveBeenCalledOnce()
  })

  it('tidak menimpa suntingan yang sudah ada', async () => {
    count.mockResolvedValue(5 as never)

    await expect(seedDefaultsIfEmpty()).resolves.toBe(0)
    expect(createMany).not.toHaveBeenCalled()
  })
})

describe('replaceGrants', () => {
  it('mengganti seluruh izin satu subjek dalam satu transaksi', async () => {
    transaction.mockResolvedValue([] as never)

    const hasil = await replaceGrants('ROLE', 'STAFF', ['tender:read', 'project:read'])

    expect(transaction).toHaveBeenCalledOnce()
    expect(hasil).toEqual([
      { subjectType: 'ROLE', subject: 'STAFF', permission: 'tender:read' },
      { subjectType: 'ROLE', subject: 'STAFF', permission: 'project:read' },
    ])
  })

  it('membuang izin kembar sebelum menyimpan', async () => {
    transaction.mockResolvedValue([] as never)

    const hasil = await replaceGrants('ROLE', 'STAFF', ['tender:read', 'tender:read'])

    expect(hasil).toHaveLength(1)
  })

  it('menolak sebelum menyentuh basis data bila ada izin terlarang', async () => {
    await expect(replaceGrants('ROLE', 'STAFF', ['user:write'])).rejects.toMatchObject({
      code: 'USER_PERMISSION_RESERVED',
    })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('menolak penyuntingan subjek yang dikunci', async () => {
    await expect(
      replaceGrants('ROLE', 'SUPERADMIN', ['cost:approve']),
    ).rejects.toMatchObject({ code: 'SUBJECT_LOCKED' })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('membuang singgahan agar perubahan segera berlaku', async () => {
    findMany.mockResolvedValue([] as never)
    transaction.mockResolvedValue([] as never)

    await loadMatrix(NOW)
    await replaceGrants('ROLE', 'STAFF', ['tender:read'])
    await loadMatrix(NOW)

    expect(findMany).toHaveBeenCalledTimes(2)
  })
})
