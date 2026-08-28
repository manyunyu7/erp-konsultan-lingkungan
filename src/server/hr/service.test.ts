import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BusinessRuleError } from '@/server/shared/constants'

// Prisma di-mock penuh: service diuji sebagai orkestrator, bukan integrasi DB.
vi.mock('@/lib/db', () => ({
  db: {
    personnel: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    certification: { findMany: vi.fn() },
    assignment: { create: vi.fn() },
    kpiEvaluation: { create: vi.fn() },
    manpowerRequest: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import {
  assignPersonnelToProject,
  createKpiEvaluation,
  createManpowerRequest,
  getSelectionStages,
  listExpiringCertifications,
  transitionManpowerRequest,
} from './service'

const mocked = db as unknown as {
  personnel: { findUnique: ReturnType<typeof vi.fn> }
  project: { findUnique: ReturnType<typeof vi.fn> }
  certification: { findMany: ReturnType<typeof vi.fn> }
  assignment: { create: ReturnType<typeof vi.fn> }
  kpiEvaluation: { create: ReturnType<typeof vi.fn> }
  manpowerRequest: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

const NOW = new Date('2026-01-01T00:00:00.000Z')
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000)

async function expectRule(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toMatchObject({ code })
  await expect(fn()).rejects.toBeInstanceOf(BusinessRuleError)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createKpiEvaluation', () => {
  const input = {
    personnelId: 'p1',
    periodType: 'ANNUAL' as const,
    periodYear: 2026,
    punctualityScore: 80,
    qualityScore: 90,
    teamworkScore: 70,
    evaluatedAt: NOW,
  }

  it('menyimpan evaluasi beserta totalScore dan predikat', async () => {
    mocked.personnel.findUnique.mockResolvedValue({
      id: 'p1',
      employmentType: 'TETAP',
      isActive: true,
    })
    mocked.kpiEvaluation.create.mockResolvedValue({ id: 'k1' })

    const result = await createKpiEvaluation(input)

    expect(result).toEqual({ id: 'k1', predicate: 'BAIK' })
    expect(mocked.kpiEvaluation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ totalScore: 81.5, projectId: null, periodYear: 2026, note: null }),
    })
  })

  it('menormalkan field opsional dari nilai yang diberikan', async () => {
    mocked.personnel.findUnique.mockResolvedValue({
      id: 'p1',
      employmentType: 'PKWT',
      isActive: true,
    })
    mocked.kpiEvaluation.create.mockResolvedValue({ id: 'k2' })

    await createKpiEvaluation({
      ...input,
      periodType: 'PER_PROJECT',
      periodYear: undefined,
      projectId: 'prj1',
      note: 'bagus',
    })

    expect(mocked.kpiEvaluation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'prj1', periodYear: null, note: 'bagus' }),
    })
  })

  it('menolak personel tidak ditemukan', async () => {
    mocked.personnel.findUnique.mockResolvedValue(null)
    await expectRule(() => createKpiEvaluation(input), 'PERSONNEL_NOT_FOUND')
  })

  it('menolak personel non-aktif', async () => {
    mocked.personnel.findUnique.mockResolvedValue({ employmentType: 'TETAP', isActive: false })
    await expectRule(() => createKpiEvaluation(input), 'PERSONNEL_INACTIVE')
  })
})

describe('assignPersonnelToProject', () => {
  const input = { projectId: 'prj1', personnelId: 'p1', role: 'Ketua Tim', startDate: NOW }
  const amdalCerts = [
    { name: 'KTPA', expiresAt: day(100) },
    { name: 'K3', expiresAt: day(100) },
    { name: 'AMBIL_SAMPEL', expiresAt: day(100) },
    { name: 'SKK', expiresAt: day(100) },
  ]

  function ready() {
    mocked.project.findUnique.mockResolvedValue({ id: 'prj1', documentType: 'AMDAL' })
    mocked.personnel.findUnique.mockResolvedValue({ id: 'p1', isActive: true })
    mocked.certification.findMany.mockResolvedValue(amdalCerts)
  }

  it('membuat penugasan bila sertifikat lengkap', async () => {
    ready()
    mocked.assignment.create.mockResolvedValue({ id: 'a1' })

    await expect(assignPersonnelToProject(input)).resolves.toEqual({ id: 'a1' })
    expect(mocked.assignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ endDate: null }),
    })
  })

  it('meneruskan endDate bila diisi', async () => {
    ready()
    mocked.assignment.create.mockResolvedValue({ id: 'a2' })
    await assignPersonnelToProject({ ...input, endDate: day(30) })
    expect(mocked.assignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ endDate: day(30) }),
    })
  })

  it('menolak proyek tidak ditemukan', async () => {
    mocked.project.findUnique.mockResolvedValue(null)
    mocked.personnel.findUnique.mockResolvedValue({ id: 'p1', isActive: true })
    await expectRule(() => assignPersonnelToProject(input), 'PROJECT_NOT_FOUND')
  })

  it('menolak personel tidak ditemukan', async () => {
    mocked.project.findUnique.mockResolvedValue({ id: 'prj1', documentType: 'AMDAL' })
    mocked.personnel.findUnique.mockResolvedValue(null)
    await expectRule(() => assignPersonnelToProject(input), 'PERSONNEL_NOT_FOUND')
  })

  it('menolak personel non-aktif', async () => {
    mocked.project.findUnique.mockResolvedValue({ id: 'prj1', documentType: 'AMDAL' })
    mocked.personnel.findUnique.mockResolvedValue({ id: 'p1', isActive: false })
    await expectRule(() => assignPersonnelToProject(input), 'PERSONNEL_INACTIVE')
  })

  it('menolak bila sertifikat AMDAL kurang', async () => {
    mocked.project.findUnique.mockResolvedValue({ id: 'prj1', documentType: 'AMDAL' })
    mocked.personnel.findUnique.mockResolvedValue({ id: 'p1', isActive: true })
    mocked.certification.findMany.mockResolvedValue([{ name: 'K3', expiresAt: day(100) }])
    await expectRule(() => assignPersonnelToProject(input), 'ASSIGNMENT_CERTIFICATION_MISSING')
    expect(mocked.assignment.create).not.toHaveBeenCalled()
  })
})

describe('listExpiringCertifications', () => {
  it('hanya mengembalikan sertifikat dalam ambang H-60, terurut', async () => {
    mocked.certification.findMany.mockResolvedValue([
      { id: 'c1', name: 'K3', personnelId: 'p1', expiresAt: day(50) },
      { id: 'c2', name: 'SKK', personnelId: 'p1', expiresAt: day(10) },
      { id: 'c3', name: 'KTPA', personnelId: 'p2', expiresAt: day(90) },
      { id: 'c4', name: 'ATPA', personnelId: 'p2', expiresAt: day(-3) },
    ])

    const result = await listExpiringCertifications(NOW)
    expect(result.map((r: { id: string }) => r.id)).toEqual(['c2', 'c1'])
    expect(result[0].daysRemaining).toBe(10)
  })
})

describe('createManpowerRequest', () => {
  const input = {
    formNumber: 'F-HR-01/2026/001',
    requestedById: 'u1',
    position: 'Ahli Kualitas Udara',
    employmentType: 'FREELANCE_EXPERT' as const,
    qualification: 'S1 Teknik Lingkungan',
    certifications: 'K3',
    quantity: 1,
    neededBy: day(30),
  }

  it('membuat form dan mengembalikan tahapan seleksi', async () => {
    mocked.manpowerRequest.findUnique.mockResolvedValue(null)
    mocked.manpowerRequest.create.mockResolvedValue({ id: 'm1', status: 'SUBMITTED' })

    const result = await createManpowerRequest(input, NOW)
    expect(result.selectionStages[0]).toBe('SELEKSI_PORTOFOLIO')
    expect(mocked.manpowerRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'SUBMITTED' }),
    })
  })

  it('menolak nomor form ganda', async () => {
    mocked.manpowerRequest.findUnique.mockResolvedValue({ id: 'm0' })
    await expectRule(() => createManpowerRequest(input, NOW), 'MANPOWER_DUPLICATE_FORM_NUMBER')
  })

  it('menolak form tidak valid sebelum menyentuh database', async () => {
    await expectRule(
      () => createManpowerRequest({ ...input, quantity: 0 }, NOW),
      'MANPOWER_INVALID_QUANTITY',
    )
    expect(mocked.manpowerRequest.findUnique).not.toHaveBeenCalled()
  })
})

describe('transitionManpowerRequest', () => {
  it('memperbarui status untuk transisi sah', async () => {
    mocked.manpowerRequest.findUnique.mockResolvedValue({ id: 'm1', status: 'SUBMITTED' })
    mocked.manpowerRequest.update.mockResolvedValue({ id: 'm1', status: 'APPROVED' })

    await expect(transitionManpowerRequest('m1', 'APPROVED')).resolves.toEqual({
      id: 'm1',
      status: 'APPROVED',
    })
  })

  it('menolak transisi tidak sah', async () => {
    mocked.manpowerRequest.findUnique.mockResolvedValue({ id: 'm1', status: 'SUBMITTED' })
    await expectRule(() => transitionManpowerRequest('m1', 'FULFILLED'), 'MANPOWER_INVALID_TRANSITION')
  })

  it('menolak form tidak ditemukan', async () => {
    mocked.manpowerRequest.findUnique.mockResolvedValue(null)
    await expectRule(() => transitionManpowerRequest('x', 'APPROVED'), 'MANPOWER_REQUEST_NOT_FOUND')
  })
})

describe('getSelectionStages', () => {
  it('mengembalikan tahapan sesuai employmentType tersimpan', async () => {
    mocked.manpowerRequest.findUnique.mockResolvedValue({ employmentType: 'TETAP' })
    await expect(getSelectionStages('m1')).resolves.toEqual([
      'SELEKSI_BERKAS',
      'WAWANCARA_HR',
      'WAWANCARA_TEKNIS',
      'USER_TEST',
    ])
  })

  it('menolak form tidak ditemukan', async () => {
    mocked.manpowerRequest.findUnique.mockResolvedValue(null)
    await expectRule(() => getSelectionStages('x'), 'MANPOWER_REQUEST_NOT_FOUND')
  })
})
