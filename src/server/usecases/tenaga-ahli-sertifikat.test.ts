/**
 * SKENARIO 4 — Tenaga ahli dan masa berlaku sertifikat.
 *
 * Aturan SOP: personel hanya boleh ditugaskan ke proyek AMDAL bila seluruh
 * kelompok sertifikat wajib (KTPA/ATPA, K3, AMBIL_SAMPEL, SKK) masih aktif
 * PADA TANGGAL MULAI PENUGASAN — bukan pada hari pengecekan. Sertifikat yang
 * mendekati kedaluwarsa memicu penanda peringatan H-60.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    project: { findUnique: vi.fn() },
    personnel: { findUnique: vi.fn() },
    certification: { findMany: vi.fn() },
    assignment: { create: vi.fn() },
    manpowerRequest: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  CERTIFICATE_WARNING_DAYS,
  assignPersonnelToProject,
  createManpowerRequest,
  daysUntilExpiry,
  isExpiryWarning,
  listExpiringCertifications,
  missingCertifications,
  transitionManpowerRequest,
} from '@/server/hr'

type Fn = ReturnType<typeof vi.fn>
const mocked = db as unknown as Record<string, Record<string, Fn>>

const at = (iso: string) => new Date(iso)
const HARI_INI = at('2026-06-01T00:00:00.000Z')
/** Geser hari dari HARI_INI tanpa bergantung zona waktu lokal. */
const hariKe = (offset: number) => new Date(HARI_INI.getTime() + offset * 86_400_000)

const PROYEK_AMDAL = { id: 'jo-2026-007', documentType: 'AMDAL' }
const PROYEK_UKL_UPL = { id: 'jo-2026-004', documentType: 'UKL_UPL' }

const ANDI = { id: 'per-andi-prasetyo', fullName: 'Andi Prasetyo, S.T., M.Ling.', isActive: true }
const RATNA = { id: 'per-ratna-puspita', fullName: 'Ratna Puspita Sari, S.Si., M.Si.', isActive: true }
const YUDI = { id: 'per-yudi-hermawan', fullName: 'Yudi Hermawan, S.Si.', isActive: true }
const BAGUS = { id: 'per-bagus-setiawan', fullName: 'Bagus Setiawan, A.Md.', isActive: false }

/** Sertifikat lengkap dan masih lama berlakunya — layak untuk AMDAL. */
const SERTIFIKAT_ANDI = [
  { id: 'crt-1', personnelId: ANDI.id, name: 'KTPA', expiresAt: hariKe(480) },
  { id: 'crt-2', personnelId: ANDI.id, name: 'K3', expiresAt: hariKe(300) },
  { id: 'crt-3', personnelId: ANDI.id, name: 'AMBIL_SAMPEL', expiresAt: hariKe(600) },
  { id: 'crt-4', personnelId: ANDI.id, name: 'SKK', expiresAt: hariKe(660) },
]

/** ATPA sudah kedaluwarsa 30 hari lalu, dan SKK memang tidak dimiliki. */
const SERTIFIKAT_RATNA = [
  { id: 'crt-5', personnelId: RATNA.id, name: 'ATPA', expiresAt: hariKe(-30) },
  { id: 'crt-6', personnelId: RATNA.id, name: 'K3', expiresAt: hariKe(690) },
]

/** Sertifikat pengambilan contoh uji kedaluwarsa 45 hari lagi -> peringatan H-60. */
const SERTIFIKAT_YUDI = [
  { id: 'crt-7', personnelId: YUDI.id, name: 'AMBIL_SAMPEL', expiresAt: hariKe(45) },
  { id: 'crt-8', personnelId: YUDI.id, name: 'K3', expiresAt: hariKe(630) },
]

async function expectBusinessRule(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(BusinessRuleError)
  await promise.catch((error: BusinessRuleError) => expect(error.code).toBe(code))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Skenario: penugasan tenaga ahli pada proyek AMDAL Bendungan Cisokan', () => {
  it('menerima Ketua Tim Penyusun yang seluruh sertifikat wajibnya masih berlaku', async () => {
    mocked.project.findUnique.mockResolvedValue(PROYEK_AMDAL)
    mocked.personnel.findUnique.mockResolvedValue(ANDI)
    mocked.certification.findMany.mockResolvedValue(SERTIFIKAT_ANDI)
    mocked.assignment.create.mockImplementation(async (a: { data: unknown }) => ({
      id: 'asg-1',
      ...(a.data as object),
    }))

    const assignment = await assignPersonnelToProject({
      projectId: PROYEK_AMDAL.id,
      personnelId: ANDI.id,
      role: 'Ketua Tim Penyusun',
      startDate: hariKe(7),
    })

    expect(assignment).toMatchObject({
      projectId: PROYEK_AMDAL.id,
      personnelId: ANDI.id,
      role: 'Ketua Tim Penyusun',
    })
  })

  it('menolak ahli biologi karena sertifikat ATPA sudah kedaluwarsa dan SKK belum dimiliki', async () => {
    mocked.project.findUnique.mockResolvedValue(PROYEK_AMDAL)
    mocked.personnel.findUnique.mockResolvedValue(RATNA)
    mocked.certification.findMany.mockResolvedValue(SERTIFIKAT_RATNA)

    await expectBusinessRule(
      assignPersonnelToProject({
        projectId: PROYEK_AMDAL.id,
        personnelId: RATNA.id,
        role: 'Ahli Biologi',
        startDate: hariKe(7),
      }),
      'ASSIGNMENT_CERTIFICATION_MISSING',
    )

    expect(mocked.assignment.create).not.toHaveBeenCalled()
    // Kelompok yang belum terpenuhi dinyatakan eksplisit agar HR tahu apa yang kurang.
    expect(missingCertifications(SERTIFIKAT_RATNA, 'AMDAL', hariKe(7))).toEqual([
      'KTPA/ATPA',
      'AMBIL_SAMPEL',
      'SKK',
    ])
  })

  it('tetap menolak ahli biologi yang sama di proyek UKL-UPL, kali ini hanya karena sertifikat AMBIL_SAMPEL tidak dimiliki', async () => {
    mocked.project.findUnique.mockResolvedValue(PROYEK_UKL_UPL)
    mocked.personnel.findUnique.mockResolvedValue(RATNA)
    mocked.certification.findMany.mockResolvedValue(SERTIFIKAT_RATNA)

    await expectBusinessRule(
      assignPersonnelToProject({
        projectId: PROYEK_UKL_UPL.id,
        personnelId: RATNA.id,
        role: 'Ahli Biologi Perairan',
        startDate: hariKe(3),
      }),
      'ASSIGNMENT_CERTIFICATION_MISSING',
    )
    expect(missingCertifications(SERTIFIKAT_RATNA, 'UKL_UPL', hariKe(3))).toEqual(['AMBIL_SAMPEL'])
  })

  it('menolak penugasan yang dimulai SETELAH sertifikat kedaluwarsa walau hari ini masih berlaku', async () => {
    mocked.project.findUnique.mockResolvedValue(PROYEK_UKL_UPL)
    mocked.personnel.findUnique.mockResolvedValue(YUDI)
    mocked.certification.findMany.mockResolvedValue(SERTIFIKAT_YUDI)

    // Hari ini sertifikat AMBIL_SAMPEL masih aktif (habis H+45)...
    expect(missingCertifications(SERTIFIKAT_YUDI, 'UKL_UPL', HARI_INI)).toEqual([])

    // ...tetapi penugasan direncanakan mulai H+60, saat sertifikat sudah mati.
    await expectBusinessRule(
      assignPersonnelToProject({
        projectId: PROYEK_UKL_UPL.id,
        personnelId: YUDI.id,
        role: 'Ahli Kualitas Udara',
        startDate: hariKe(60),
      }),
      'ASSIGNMENT_CERTIFICATION_MISSING',
    )
  })

  it('menerima penugasan personel yang sama bila dimulai sebelum sertifikatnya kedaluwarsa', async () => {
    mocked.project.findUnique.mockResolvedValue(PROYEK_UKL_UPL)
    mocked.personnel.findUnique.mockResolvedValue(YUDI)
    mocked.certification.findMany.mockResolvedValue(SERTIFIKAT_YUDI)
    mocked.assignment.create.mockImplementation(async (a: { data: unknown }) => ({
      id: 'asg-2',
      ...(a.data as object),
    }))

    const assignment = await assignPersonnelToProject({
      projectId: PROYEK_UKL_UPL.id,
      personnelId: YUDI.id,
      role: 'Ahli Kualitas Udara',
      startDate: hariKe(20),
    })

    expect(assignment.personnelId).toBe(YUDI.id)
  })

  it('menolak penugasan personel non-aktif sebelum sertifikatnya sempat diperiksa', async () => {
    mocked.project.findUnique.mockResolvedValue(PROYEK_UKL_UPL)
    mocked.personnel.findUnique.mockResolvedValue(BAGUS)

    await expectBusinessRule(
      assignPersonnelToProject({
        projectId: PROYEK_UKL_UPL.id,
        personnelId: BAGUS.id,
        role: 'Surveyor Lapangan',
        startDate: hariKe(5),
      }),
      'PERSONNEL_INACTIVE',
    )
    expect(mocked.certification.findMany).not.toHaveBeenCalled()
  })
})

describe('Skenario: peringatan perpanjangan sertifikat H-60', () => {
  it('menandai sertifikat AMBIL_SAMPEL yang kedaluwarsa 45 hari lagi sebagai perlu perpanjangan', async () => {
    mocked.certification.findMany.mockResolvedValue([
      ...SERTIFIKAT_ANDI,
      ...SERTIFIKAT_YUDI,
      ...SERTIFIKAT_RATNA,
    ])

    const expiring = await listExpiringCertifications(HARI_INI)

    expect(CERTIFICATE_WARNING_DAYS).toBe(60)
    expect(expiring).toHaveLength(1)
    expect(expiring[0]).toMatchObject({
      name: 'AMBIL_SAMPEL',
      personnelId: YUDI.id,
      daysRemaining: 45,
    })
    expect(isExpiryWarning(SERTIFIKAT_YUDI[0].expiresAt, HARI_INI)).toBe(true)
  })

  it('tidak menandai sertifikat yang masih jauh dari kedaluwarsa maupun yang sudah lewat', () => {
    // KTPA Andi masih 480 hari lagi -> di luar ambang peringatan.
    expect(isExpiryWarning(hariKe(480), HARI_INI)).toBe(false)
    // ATPA Ratna sudah lewat 30 hari -> bukan "perlu perpanjangan", melainkan sudah mati.
    expect(isExpiryWarning(hariKe(-30), HARI_INI)).toBe(false)
    expect(daysUntilExpiry(hariKe(-30), HARI_INI)).toBe(-30)
  })

  it('memicu permintaan personel F-HR-01 untuk menggantikan ahli yang sertifikatnya mati', async () => {
    mocked.manpowerRequest.findUnique.mockResolvedValue(null)
    mocked.manpowerRequest.create.mockImplementation(async (a: { data: unknown }) => ({
      id: 'mpr-1',
      ...(a.data as object),
    }))

    const request = await createManpowerRequest(
      {
        formNumber: 'F-HR-01/2026/007',
        requestedById: 'usr-andi-prasetyo',
        position: 'Ahli Biologi (Flora & Fauna)',
        employmentType: 'FREELANCE_EXPERT',
        qualification: 'S2 Biologi/Ekologi, pengalaman minimal 5 proyek AMDAL',
        certifications: 'ATPA aktif, K3 Umum',
        quantity: 1,
        neededBy: hariKe(30),
      },
      HARI_INI,
    )

    expect(request.status).toBe('SUBMITTED')
    // Tenaga ahli lepas diseleksi lewat portofolio, bukan wawancara berjenjang.
    expect(request.selectionStages).toEqual([
      'SELEKSI_PORTOFOLIO',
      'VERIFIKASI_CV',
      'VERIFIKASI_IJAZAH',
      'VERIFIKASI_SERTIFIKAT_KOMPETENSI',
    ])
  })

  it('menolak F-HR-01 yang tanggal kebutuhannya sudah lewat', async () => {
    await expectBusinessRule(
      createManpowerRequest(
        {
          formNumber: 'F-HR-01/2026/008',
          requestedById: 'usr-andi-prasetyo',
          position: 'Surveyor Lapangan',
          employmentType: 'PKWT',
          qualification: 'D3 Teknik Lingkungan',
          certifications: 'K3 Umum',
          quantity: 2,
          neededBy: hariKe(-1),
        },
        HARI_INI,
      ),
      'MANPOWER_NEEDED_BY_IN_PAST',
    )
  })

  it('menolak F-HR-01 yang sudah REJECTED dipaksa menjadi FULFILLED', async () => {
    mocked.manpowerRequest.findUnique.mockResolvedValue({ id: 'mpr-4', status: 'REJECTED' })

    await expectBusinessRule(
      transitionManpowerRequest('mpr-4', 'FULFILLED'),
      'MANPOWER_INVALID_TRANSITION',
    )
  })
})
