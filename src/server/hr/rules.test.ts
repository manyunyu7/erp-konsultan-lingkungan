import { describe, expect, it } from 'vitest'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  assertAssignmentEligibility,
  assertManpowerTransition,
  assertValidScore,
  assertValidScores,
  calculateKpiTotalScore,
  canTransitionManpowerRequest,
  CERTIFICATE_WARNING_DAYS,
  daysUntilExpiry,
  expectedPeriodType,
  hasActiveCertification,
  isCertificationActive,
  isExpired,
  isExpiryWarning,
  missingCertifications,
  requiredCertificationsFor,
  resolveKpiPredicate,
  selectionStagesFor,
  validateKpiEvaluation,
  validateManpowerRequestForm,
  type CertificationLike,
} from './rules'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000)

function expectRule(fn: () => unknown, code: string) {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(BusinessRuleError)
    expect((e as BusinessRuleError).code).toBe(code)
    return
  }
  throw new Error(`expected BusinessRuleError ${code}`)
}

describe('skor KPI', () => {
  it('menerima skor batas 0 dan 100', () => {
    expect(() => assertValidScore('x', 0)).not.toThrow()
    expect(() => assertValidScore('x', 100)).not.toThrow()
  })

  it.each([-1, 101, 50.5, NaN])('menolak skor %s', (score) => {
    expectRule(() => assertValidScore('x', score), 'KPI_SCORE_OUT_OF_RANGE')
  })

  it('memvalidasi ketiga indikator', () => {
    expect(() =>
      assertValidScores({ punctualityScore: 10, qualityScore: 20, teamworkScore: 30 }),
    ).not.toThrow()
    expectRule(
      () => assertValidScores({ punctualityScore: 10, qualityScore: 200, teamworkScore: 30 }),
      'KPI_SCORE_OUT_OF_RANGE',
    )
    expectRule(
      () => assertValidScores({ punctualityScore: 10, qualityScore: 20, teamworkScore: -5 }),
      'KPI_SCORE_OUT_OF_RANGE',
    )
  })

  it('menghitung rata-rata berbobot dan membulatkan 2 desimal', () => {
    expect(
      calculateKpiTotalScore({ punctualityScore: 80, qualityScore: 90, teamworkScore: 70 }),
    ).toBe(81.5)
    expect(
      calculateKpiTotalScore({ punctualityScore: 100, qualityScore: 100, teamworkScore: 100 }),
    ).toBe(100)
    expect(
      calculateKpiTotalScore({ punctualityScore: 83, qualityScore: 77, teamworkScore: 91 }),
    ).toBe(82.6)
  })

  it('memetakan skor ke predikat', () => {
    expect(resolveKpiPredicate(90)).toBe('SANGAT_BAIK')
    expect(resolveKpiPredicate(89.99)).toBe('BAIK')
    expect(resolveKpiPredicate(75)).toBe('BAIK')
    expect(resolveKpiPredicate(74.99)).toBe('CUKUP')
    expect(resolveKpiPredicate(60)).toBe('CUKUP')
    expect(resolveKpiPredicate(59.99)).toBe('PERLU_PERBAIKAN')
  })
})

describe('validateKpiEvaluation', () => {
  const base = { personnelId: 'p1', punctualityScore: 80, qualityScore: 90, teamworkScore: 70 }

  it('menentukan periode sesuai jenis kepegawaian', () => {
    expect(expectedPeriodType('TETAP')).toBe('ANNUAL')
    expect(expectedPeriodType('PKWT')).toBe('PER_PROJECT')
    expect(expectedPeriodType('FREELANCE_EXPERT')).toBe('PER_PROJECT')
  })

  it('menerima evaluasi tahunan karyawan tetap', () => {
    expect(
      validateKpiEvaluation({
        ...base,
        employmentType: 'TETAP',
        periodType: 'ANNUAL',
        periodYear: 2026,
      }),
    ).toEqual({ totalScore: 81.5, predicate: 'BAIK' })
  })

  it('menerima evaluasi per-proyek tenaga ahli', () => {
    expect(
      validateKpiEvaluation({
        ...base,
        employmentType: 'FREELANCE_EXPERT',
        periodType: 'PER_PROJECT',
        projectId: 'prj1',
      }).predicate,
    ).toBe('BAIK')
  })

  it('menolak kombinasi periode yang salah', () => {
    expectRule(
      () =>
        validateKpiEvaluation({
          ...base,
          employmentType: 'TETAP',
          periodType: 'PER_PROJECT',
          projectId: 'prj1',
        }),
      'KPI_PERIOD_TYPE_MISMATCH',
    )
    expectRule(
      () =>
        validateKpiEvaluation({
          ...base,
          employmentType: 'PKWT',
          periodType: 'ANNUAL',
          periodYear: 2026,
        }),
      'KPI_PERIOD_TYPE_MISMATCH',
    )
  })

  it('mewajibkan periodYear untuk evaluasi tahunan', () => {
    expectRule(
      () => validateKpiEvaluation({ ...base, employmentType: 'TETAP', periodType: 'ANNUAL' }),
      'KPI_PERIOD_YEAR_REQUIRED',
    )
    expectRule(
      () =>
        validateKpiEvaluation({
          ...base,
          employmentType: 'TETAP',
          periodType: 'ANNUAL',
          periodYear: null,
        }),
      'KPI_PERIOD_YEAR_REQUIRED',
    )
  })

  it.each([1999, 2026.5])('menolak periodYear tidak valid %s', (year) => {
    expectRule(
      () =>
        validateKpiEvaluation({
          ...base,
          employmentType: 'TETAP',
          periodType: 'ANNUAL',
          periodYear: year,
        }),
      'KPI_PERIOD_YEAR_INVALID',
    )
  })

  it('mewajibkan projectId untuk evaluasi per-proyek', () => {
    expectRule(
      () => validateKpiEvaluation({ ...base, employmentType: 'PKWT', periodType: 'PER_PROJECT' }),
      'KPI_PROJECT_REQUIRED',
    )
  })
})

describe('sertifikasi', () => {
  const certs: CertificationLike[] = [
    { name: 'KTPA', expiresAt: day(200) },
    { name: 'K3', expiresAt: day(30) },
    { name: 'AMBIL_SAMPEL', expiresAt: day(-1) },
  ]

  it('mendaftar sertifikat wajib per jenis dokumen', () => {
    expect(requiredCertificationsFor('AMDAL')).toEqual([
      ['KTPA', 'ATPA'],
      ['K3'],
      ['AMBIL_SAMPEL'],
      ['SKK'],
    ])
    expect(requiredCertificationsFor('UKL_UPL')).toHaveLength(2)
    expect(requiredCertificationsFor('LAINNYA')).toEqual([])
  })

  it('mengecek keaktifan sertifikat pada tanggal acuan', () => {
    expect(isCertificationActive({ name: 'K3', expiresAt: NOW }, NOW)).toBe(true)
    expect(isCertificationActive({ name: 'K3', expiresAt: day(-1) }, NOW)).toBe(false)
    expect(hasActiveCertification(certs, 'KTPA', NOW)).toBe(true)
    expect(hasActiveCertification(certs, 'AMBIL_SAMPEL', NOW)).toBe(false)
    expect(hasActiveCertification(certs, 'SKK', NOW)).toBe(false)
  })

  it('menghitung sisa hari dan ambang H-60', () => {
    expect(daysUntilExpiry(day(30), NOW)).toBe(30)
    expect(daysUntilExpiry(day(-5), NOW)).toBe(-5)
    expect(CERTIFICATE_WARNING_DAYS).toBe(60)
    expect(isExpiryWarning(day(60), NOW)).toBe(true)
    expect(isExpiryWarning(day(61), NOW)).toBe(false)
    expect(isExpiryWarning(day(0), NOW)).toBe(true)
    expect(isExpiryWarning(day(-1), NOW)).toBe(false)
    expect(isExpired(day(-1), NOW)).toBe(true)
    expect(isExpired(day(1), NOW)).toBe(false)
  })

  it('melaporkan sertifikat yang kurang untuk AMDAL', () => {
    expect(missingCertifications(certs, 'AMDAL', NOW)).toEqual(['AMBIL_SAMPEL', 'SKK'])
  })

  it('menerima alternatif ATPA sebagai pengganti KTPA', () => {
    const full: CertificationLike[] = [
      { name: 'ATPA', expiresAt: day(10) },
      { name: 'K3', expiresAt: day(10) },
      { name: 'AMBIL_SAMPEL', expiresAt: day(10) },
      { name: 'SKK', expiresAt: day(10) },
    ]
    expect(missingCertifications(full, 'AMDAL', NOW)).toEqual([])
    expect(() => assertAssignmentEligibility(full, 'AMDAL', NOW)).not.toThrow()
  })

  it('menolak penugasan bila sertifikat kedaluwarsa di tanggal mulai', () => {
    const full: CertificationLike[] = [
      { name: 'ATPA', expiresAt: day(10) },
      { name: 'K3', expiresAt: day(10) },
      { name: 'AMBIL_SAMPEL', expiresAt: day(10) },
      { name: 'SKK', expiresAt: day(10) },
    ]
    expectRule(
      () => assertAssignmentEligibility(full, 'AMDAL', day(20)),
      'ASSIGNMENT_CERTIFICATION_MISSING',
    )
    expectRule(
      () => assertAssignmentEligibility(certs, 'AMDAL', NOW),
      'ASSIGNMENT_CERTIFICATION_MISSING',
    )
  })
})

describe('F-HR-01', () => {
  it('mengizinkan hanya transisi status yang sah', () => {
    expect(canTransitionManpowerRequest('SUBMITTED', 'APPROVED')).toBe(true)
    expect(canTransitionManpowerRequest('SUBMITTED', 'REJECTED')).toBe(true)
    expect(canTransitionManpowerRequest('APPROVED', 'FULFILLED')).toBe(true)
    expect(canTransitionManpowerRequest('SUBMITTED', 'FULFILLED')).toBe(false)
    expect(canTransitionManpowerRequest('REJECTED', 'APPROVED')).toBe(false)
    expect(canTransitionManpowerRequest('FULFILLED', 'APPROVED')).toBe(false)
    expect(() => assertManpowerTransition('APPROVED', 'FULFILLED')).not.toThrow()
    expectRule(() => assertManpowerTransition('SUBMITTED', 'FULFILLED'), 'MANPOWER_INVALID_TRANSITION')
  })

  it('membedakan tahapan seleksi per jenis kepegawaian', () => {
    expect(selectionStagesFor('FREELANCE_EXPERT')).toEqual([
      'SELEKSI_PORTOFOLIO',
      'VERIFIKASI_CV',
      'VERIFIKASI_IJAZAH',
      'VERIFIKASI_SERTIFIKAT_KOMPETENSI',
    ])
    expect(selectionStagesFor('TETAP')).toEqual([
      'SELEKSI_BERKAS',
      'WAWANCARA_HR',
      'WAWANCARA_TEKNIS',
      'USER_TEST',
    ])
    expect(selectionStagesFor('PKWT')).toEqual(selectionStagesFor('TETAP'))
  })

  const form = {
    position: 'Ahli Kualitas Udara',
    employmentType: 'PKWT' as const,
    qualification: 'S1 Teknik Lingkungan',
    certifications: 'K3, AMBIL_SAMPEL',
    quantity: 2,
    neededBy: day(30),
  }

  it('menerima form yang lengkap', () => {
    expect(() => validateManpowerRequestForm(form, NOW)).not.toThrow()
  })

  it.each([
    [{ quantity: 0 }, 'MANPOWER_INVALID_QUANTITY'],
    [{ quantity: 1.5 }, 'MANPOWER_INVALID_QUANTITY'],
    [{ neededBy: NOW }, 'MANPOWER_NEEDED_BY_IN_PAST'],
    [{ neededBy: day(-1) }, 'MANPOWER_NEEDED_BY_IN_PAST'],
    [{ qualification: '  ' }, 'MANPOWER_QUALIFICATION_REQUIRED'],
    [{ certifications: '' }, 'MANPOWER_CERTIFICATIONS_REQUIRED'],
    [{ position: '' }, 'MANPOWER_POSITION_REQUIRED'],
  ])('menolak form tidak valid %#', (patch, code) => {
    expectRule(() => validateManpowerRequestForm({ ...form, ...patch }, NOW), code as string)
  })
})
