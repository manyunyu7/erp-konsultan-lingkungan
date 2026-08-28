import { db } from '@/lib/db'
import type { PermissionMatrix } from '@/server/auth/rules'
import {
  assertGrantAllowed,
  buildMatrix,
  grantsFromDefaults,
  type Grant,
  type SubjectType,
} from './rules'

/**
 * Singgahan matriks di memori.
 *
 * Setiap permintaan HTTP memeriksa izin, sehingga membaca tabel izin setiap
 * kali akan menambah satu kueri pada tiap permintaan. Umur singgahan dibuat
 * pendek dan langsung dibuang saat matriks disunting, supaya perubahan hak
 * akses tidak tertunda lama bagi pengguna yang sedang bekerja.
 */
const CACHE_TTL_MS = 30_000

let cache: { matrix: PermissionMatrix; expiresAt: number } | null = null

export function invalidateMatrixCache(): void {
  cache = null
}

export async function loadMatrix(now: Date = new Date()): Promise<PermissionMatrix> {
  if (cache && cache.expiresAt > now.getTime()) return cache.matrix

  const rows = await db.permissionGrant.findMany({
    select: { subjectType: true, subject: true, permission: true },
  })
  const matrix = buildMatrix(rows as Grant[])

  cache = { matrix, expiresAt: now.getTime() + CACHE_TTL_MS }
  return matrix
}

export async function listGrants(): Promise<Grant[]> {
  const rows = await db.permissionGrant.findMany({
    select: { subjectType: true, subject: true, permission: true },
    orderBy: [{ subjectType: 'asc' }, { subject: 'asc' }, { permission: 'asc' }],
  })
  return rows as Grant[]
}

/** Mengisi tabel dengan matriks bawaan bila masih kosong. */
export async function seedDefaultsIfEmpty(): Promise<number> {
  if ((await db.permissionGrant.count()) > 0) return 0

  const grants = grantsFromDefaults()
  await db.permissionGrant.createMany({ data: grants })
  invalidateMatrixCache()
  return grants.length
}

/**
 * Mengganti seluruh izin satu subjek sekaligus.
 *
 * Penggantian utuh dipilih agar tidak ada keadaan setengah jadi ketika
 * administrator mencentang dan melepas beberapa izin dalam satu langkah.
 */
export async function replaceGrants(
  subjectType: SubjectType,
  subject: string,
  permissions: string[],
): Promise<Grant[]> {
  const unik = [...new Set(permissions)]
  for (const permission of unik) {
    assertGrantAllowed({ subjectType, subject, permission })
  }

  await db.$transaction([
    db.permissionGrant.deleteMany({ where: { subjectType, subject } }),
    db.permissionGrant.createMany({
      data: unik.map((permission) => ({ subjectType, subject, permission })),
    }),
  ])

  invalidateMatrixCache()
  return unik.map((permission) => ({ subjectType, subject, permission }))
}
