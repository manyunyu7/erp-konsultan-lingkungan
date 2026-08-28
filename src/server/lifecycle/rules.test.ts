import { describe, expect, it } from 'vitest'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  assertBastIssuable,
  assertCsatSendable,
  assertDeliverableTransition,
  assertLabSampleTransition,
  assertLaboratoryName,
  assertProjectDates,
  assertProjectTransition,
  assertStagePrerequisites,
  assertTenderTransition,
  buildClosureChecklist,
  buildProjectDraftFromTender,
  calculateCsatScore,
  canTransitionProject,
  canTransitionTender,
  csatCategory,
  isBindingContract,
  prerequisiteStages,
  stageIndex,
  CSAT_WEIGHTS,
} from './rules'

const NOW = new Date('2026-03-01T00:00:00Z')
const DEADLINE = new Date('2026-03-10T00:00:00Z')

function code(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    return (error as BusinessRuleError).code
  }
  throw new Error('diharapkan melempar BusinessRuleError')
}

describe('transisi tender', () => {
  it('mengizinkan alur normal', () => {
    expect(canTransitionTender('IDENTIFIED', 'PREPARING')).toBe(true)
    expect(canTransitionTender('PREPARING', 'SUBMITTED')).toBe(true)
    expect(canTransitionTender('SUBMITTED', 'WON')).toBe(true)
    expect(canTransitionTender('SUBMITTED', 'LOST')).toBe(true)
  })

  it('mengizinkan CANCELLED kecuali dari WON/LOST/CANCELLED', () => {
    expect(canTransitionTender('IDENTIFIED', 'CANCELLED')).toBe(true)
    expect(canTransitionTender('PREPARING', 'CANCELLED')).toBe(true)
    expect(canTransitionTender('SUBMITTED', 'CANCELLED')).toBe(true)
    expect(canTransitionTender('WON', 'CANCELLED')).toBe(false)
    expect(canTransitionTender('LOST', 'CANCELLED')).toBe(false)
    expect(canTransitionTender('CANCELLED', 'PREPARING')).toBe(false)
  })

  it('menolak lompatan status', () => {
    expect(
      code(() =>
        assertTenderTransition({
          from: 'IDENTIFIED',
          to: 'WON',
          submissionDeadline: DEADLINE,
          now: NOW,
        }),
      ),
    ).toBe('TENDER_INVALID_TRANSITION')
  })

  it('meloloskan submit sebelum deadline', () => {
    expect(() =>
      assertTenderTransition({
        from: 'PREPARING',
        to: 'SUBMITTED',
        submissionDeadline: DEADLINE,
        now: NOW,
      }),
    ).not.toThrow()
  })

  it('menolak submit setelah deadline', () => {
    expect(
      code(() =>
        assertTenderTransition({
          from: 'PREPARING',
          to: 'SUBMITTED',
          submissionDeadline: DEADLINE,
          now: new Date('2026-03-11T00:00:00Z'),
        }),
      ),
    ).toBe('TENDER_DEADLINE_PASSED')
  })

  it('tidak mengecek deadline untuk transisi non-submit', () => {
    expect(() =>
      assertTenderTransition({
        from: 'SUBMITTED',
        to: 'WON',
        submissionDeadline: DEADLINE,
        now: new Date('2026-06-01T00:00:00Z'),
      }),
    ).not.toThrow()
  })
})

describe('konversi tender ke proyek', () => {
  const base = {
    id: 't1',
    clientId: 'c1',
    status: 'WON' as const,
    bidValue: 500_000_000,
    estimatedValue: 600_000_000,
  }
  const args = {
    code: 'JO-001',
    name: 'AMDAL Pabrik',
    documentType: 'AMDAL',
    startDate: new Date('2026-04-01T00:00:00Z'),
    endDate: new Date('2026-10-01T00:00:00Z'),
  }

  it('memakai bidValue bila tersedia', () => {
    const draft = buildProjectDraftFromTender({ tender: base, ...args })
    expect(draft).toMatchObject({
      clientId: 'c1',
      tenderId: 't1',
      contractValue: 500_000_000,
      status: 'PREPARATION',
      code: 'JO-001',
      name: 'AMDAL Pabrik',
      documentType: 'AMDAL',
    })
  })

  it('jatuh ke estimatedValue bila bidValue kosong', () => {
    const draft = buildProjectDraftFromTender({
      tender: { ...base, bidValue: null },
      ...args,
    })
    expect(draft.contractValue).toBe(600_000_000)
  })

  it('menolak tender belum menang', () => {
    expect(
      code(() => buildProjectDraftFromTender({ tender: { ...base, status: 'SUBMITTED' }, ...args })),
    ).toBe('TENDER_NOT_WON')
  })

  it('menolak tender tanpa nilai', () => {
    expect(
      code(() =>
        buildProjectDraftFromTender({
          tender: { ...base, bidValue: null, estimatedValue: null },
          ...args,
        }),
      ),
    ).toBe('TENDER_VALUE_MISSING')
  })

  it('menolak rentang tanggal tidak valid', () => {
    expect(
      code(() =>
        buildProjectDraftFromTender({
          tender: base,
          ...args,
          endDate: args.startDate,
        }),
      ),
    ).toBe('PROJECT_INVALID_DATE_RANGE')
  })
})

describe('transisi proyek', () => {
  const ok = { hasSignedContract: true, hasSignedBast: true }

  it('mengizinkan alur normal dan pembatalan terbatas', () => {
    expect(canTransitionProject('PREPARATION', 'RUNNING')).toBe(true)
    expect(canTransitionProject('RUNNING', 'REPORTING')).toBe(true)
    expect(canTransitionProject('REPORTING', 'CLOSING')).toBe(true)
    expect(canTransitionProject('CLOSING', 'CLOSED')).toBe(true)
    expect(canTransitionProject('REPORTING', 'CANCELLED')).toBe(true)
    expect(canTransitionProject('CLOSING', 'CANCELLED')).toBe(false)
    expect(canTransitionProject('CLOSED', 'RUNNING')).toBe(false)
    expect(canTransitionProject('CANCELLED', 'RUNNING')).toBe(false)
  })

  it('menolak transisi tidak sah', () => {
    expect(
      code(() => assertProjectTransition({ from: 'PREPARATION', to: 'CLOSED', ...ok })),
    ).toBe('PROJECT_INVALID_TRANSITION')
  })

  it('menolak RUNNING tanpa kontrak tertanda tangan', () => {
    expect(
      code(() =>
        assertProjectTransition({
          from: 'PREPARATION',
          to: 'RUNNING',
          hasSignedContract: false,
          hasSignedBast: false,
        }),
      ),
    ).toBe('PROJECT_CONTRACT_REQUIRED')
  })

  it('menerima RUNNING dengan kontrak', () => {
    expect(() =>
      assertProjectTransition({ from: 'PREPARATION', to: 'RUNNING', ...ok }),
    ).not.toThrow()
  })

  it('menolak CLOSED tanpa BAST', () => {
    expect(
      code(() =>
        assertProjectTransition({
          from: 'CLOSING',
          to: 'CLOSED',
          hasSignedContract: true,
          hasSignedBast: false,
        }),
      ),
    ).toBe('PROJECT_BAST_REQUIRED')
  })

  it('menerima CLOSED dengan BAST', () => {
    expect(() => assertProjectTransition({ from: 'CLOSING', to: 'CLOSED', ...ok })).not.toThrow()
  })

  it('validasi tanggal proyek', () => {
    expect(() =>
      assertProjectDates(new Date('2026-01-01'), new Date('2026-02-01')),
    ).not.toThrow()
    expect(code(() => assertProjectDates(new Date('2026-02-01'), new Date('2026-01-01')))).toBe(
      'PROJECT_INVALID_DATE_RANGE',
    )
  })
})

describe('isBindingContract', () => {
  it('hanya SPK/LOA/PKS yang sudah ditandatangani', () => {
    expect(isBindingContract({ type: 'SPK', signedAt: new Date() })).toBe(true)
    expect(isBindingContract({ type: 'ADDENDUM', signedAt: new Date() })).toBe(false)
    expect(isBindingContract({ type: 'PKS', signedAt: null })).toBe(false)
  })
})

describe('tahapan teknis', () => {
  it('urutan tahap sesuai SOP', () => {
    expect(stageIndex('DESK_STUDY')).toBe(0)
    expect(stageIndex('FINAL_REPORT')).toBe(5)
    expect(prerequisiteStages('DESK_STUDY')).toEqual([])
    expect(prerequisiteStages('DRAFT_REPORT')).toEqual(['DESK_STUDY', 'SAMPLING_PLAN', 'LAB_TEST'])
  })

  it('meloloskan tahap dengan prasyarat lengkap', () => {
    expect(() =>
      assertStagePrerequisites({
        stage: 'DRAFT_REPORT',
        approvedStages: ['DESK_STUDY', 'SAMPLING_PLAN', 'LAB_TEST'],
      }),
    ).not.toThrow()
  })

  it('menolak tahap dengan prasyarat belum APPROVED', () => {
    expect(
      code(() =>
        assertStagePrerequisites({ stage: 'EXPOSE', approvedStages: ['DESK_STUDY'] }),
      ),
    ).toBe('STAGE_PREREQUISITE_INCOMPLETE')
  })
})

describe('transisi deliverable', () => {
  it('mengikuti alur PENDING -> APPROVED', () => {
    expect(() =>
      assertDeliverableTransition({ from: 'PENDING', to: 'IN_PROGRESS', qcPassedAt: null }),
    ).not.toThrow()
    expect(() =>
      assertDeliverableTransition({ from: 'IN_PROGRESS', to: 'QC_REVIEW', qcPassedAt: null }),
    ).not.toThrow()
    expect(() =>
      assertDeliverableTransition({ from: 'SUBMITTED', to: 'APPROVED', qcPassedAt: null }),
    ).not.toThrow()
  })

  it('menolak lompatan status', () => {
    expect(
      code(() =>
        assertDeliverableTransition({ from: 'IN_PROGRESS', to: 'SUBMITTED', qcPassedAt: new Date() }),
      ),
    ).toBe('DELIVERABLE_INVALID_TRANSITION')
  })

  it('menolak SUBMITTED tanpa qcPassedAt', () => {
    expect(
      code(() =>
        assertDeliverableTransition({ from: 'QC_REVIEW', to: 'SUBMITTED', qcPassedAt: null }),
      ),
    ).toBe('DELIVERABLE_QC_REQUIRED')
  })

  it('menerima SUBMITTED dengan qcPassedAt', () => {
    expect(() =>
      assertDeliverableTransition({ from: 'QC_REVIEW', to: 'SUBMITTED', qcPassedAt: NOW }),
    ).not.toThrow()
  })
})

describe('lab sample', () => {
  it('menolak nama laboratorium kosong', () => {
    expect(code(() => assertLaboratoryName('   '))).toBe('LAB_NAME_REQUIRED')
    expect(() => assertLaboratoryName('Sucofindo')).not.toThrow()
  })

  it('menolak transisi tidak sah', () => {
    expect(
      code(() =>
        assertLabSampleTransition({
          from: 'COLLECTED',
          to: 'TESTED',
          cocNumber: 'COC-1',
          laboratory: 'Sucofindo',
        }),
      ),
    ).toBe('LAB_SAMPLE_INVALID_TRANSITION')
  })

  it('menolak SENT tanpa CoC (null maupun kosong)', () => {
    expect(
      code(() =>
        assertLabSampleTransition({
          from: 'COLLECTED',
          to: 'SENT',
          cocNumber: null,
          laboratory: 'Sucofindo',
        }),
      ),
    ).toBe('LAB_SAMPLE_COC_REQUIRED')
    expect(
      code(() =>
        assertLabSampleTransition({
          from: 'COLLECTED',
          to: 'SENT',
          cocNumber: '  ',
          laboratory: 'Sucofindo',
        }),
      ),
    ).toBe('LAB_SAMPLE_COC_REQUIRED')
  })

  it('menolak SENT bila laboratorium kosong', () => {
    expect(
      code(() =>
        assertLabSampleTransition({
          from: 'COLLECTED',
          to: 'SENT',
          cocNumber: 'COC-1',
          laboratory: '',
        }),
      ),
    ).toBe('LAB_NAME_REQUIRED')
  })

  it('menerima alur lengkap', () => {
    expect(() =>
      assertLabSampleTransition({
        from: 'COLLECTED',
        to: 'SENT',
        cocNumber: 'COC-1',
        laboratory: 'Sucofindo',
      }),
    ).not.toThrow()
    expect(() =>
      assertLabSampleTransition({
        from: 'TESTED',
        to: 'REPORTED',
        cocNumber: null,
        laboratory: '',
      }),
    ).not.toThrow()
  })
})

describe('BAST dan CSAT', () => {
  it('BAST butuh FINAL_REPORT APPROVED', () => {
    expect(() => assertBastIssuable({ finalReportStatus: 'APPROVED' })).not.toThrow()
    expect(code(() => assertBastIssuable({ finalReportStatus: 'SUBMITTED' }))).toBe(
      'BAST_FINAL_REPORT_REQUIRED',
    )
    expect(code(() => assertBastIssuable({ finalReportStatus: null }))).toBe(
      'BAST_FINAL_REPORT_REQUIRED',
    )
  })

  it('CSAT butuh BAST ditandatangani', () => {
    expect(() => assertCsatSendable({ bastSignedAt: NOW })).not.toThrow()
    expect(code(() => assertCsatSendable({ bastSignedAt: null }))).toBe('CSAT_BAST_REQUIRED')
  })

  it('bobot berjumlah 100%', () => {
    const total =
      CSAT_WEIGHTS.technical +
      CSAT_WEIGHTS.timeliness +
      CSAT_WEIGHTS.responsiveness +
      CSAT_WEIGHTS.compliance
    expect(total).toBeCloseTo(1, 10)
  })

  it('menghitung skor berbobot dibulatkan 2 desimal', () => {
    expect(
      calculateCsatScore({
        technicalScore: 100,
        timelinessScore: 100,
        responsivenessScore: 100,
        complianceScore: 100,
      }),
    ).toBe(100)

    // 90*.35 + 80*.25 + 70*.2 + 85*.2 = 31.5 + 20 + 14 + 17 = 82.5
    expect(
      calculateCsatScore({
        technicalScore: 90,
        timelinessScore: 80,
        responsivenessScore: 70,
        complianceScore: 85,
      }),
    ).toBe(82.5)

    // 83*.35 + 77*.25 + 64*.2 + 71*.2 = 29.05 + 19.25 + 12.8 + 14.2 = 75.3
    expect(
      calculateCsatScore({
        technicalScore: 83,
        timelinessScore: 77,
        responsivenessScore: 64,
        complianceScore: 71,
      }),
    ).toBe(75.3)
  })

  it('menolak skor di luar rentang pada tiap komponen', () => {
    const base = {
      technicalScore: 80,
      timelinessScore: 80,
      responsivenessScore: 80,
      complianceScore: 80,
    }
    expect(code(() => calculateCsatScore({ ...base, technicalScore: -1 }))).toBe(
      'CSAT_SCORE_OUT_OF_RANGE',
    )
    expect(code(() => calculateCsatScore({ ...base, timelinessScore: 101 }))).toBe(
      'CSAT_SCORE_OUT_OF_RANGE',
    )
    expect(code(() => calculateCsatScore({ ...base, responsivenessScore: Number.NaN }))).toBe(
      'CSAT_SCORE_OUT_OF_RANGE',
    )
    expect(code(() => calculateCsatScore({ ...base, complianceScore: 100.5 }))).not.toBe('')
    expect(() => calculateCsatScore({ ...base, complianceScore: 0 })).not.toThrow()
  })

  it('memetakan skor ke kategori kepuasan', () => {
    expect(csatCategory(95)).toBe('SANGAT_PUAS')
    expect(csatCategory(90)).toBe('SANGAT_PUAS')
    expect(csatCategory(89.99)).toBe('PUAS')
    expect(csatCategory(75)).toBe('PUAS')
    expect(csatCategory(74.99)).toBe('CUKUP')
    expect(csatCategory(60)).toBe('CUKUP')
    expect(csatCategory(59.99)).toBe('TIDAK_PUAS')
  })
})

describe('checklist penutupan', () => {
  const full = {
    bastIssued: true,
    finalTerminPaid: true,
    performanceBondReturned: true,
    archive: { reports: true, rawSurveyData: true, baselinePhotos: true, gisMaps: true },
  }

  it('lengkap bila semua terpenuhi', () => {
    const result = buildClosureChecklist(full)
    expect(result.complete).toBe(true)
    expect(result.items.map((i) => i.key)).toEqual([
      'BAST_ISSUED',
      'FINAL_TERMIN_PAID',
      'PERFORMANCE_BOND_RETURNED',
      'ARCHIVE_COMPLETE',
    ])
    expect(result.items.every((i) => i.fulfilled)).toBe(true)
    expect(result.items[3].label).toContain('peta GIS')
  })

  it('menandai arsip belum lengkap untuk tiap komponen arsip', () => {
    for (const key of ['reports', 'rawSurveyData', 'baselinePhotos', 'gisMaps'] as const) {
      const result = buildClosureChecklist({
        ...full,
        archive: { ...full.archive, [key]: false },
      })
      expect(result.complete).toBe(false)
      expect(result.items[3].fulfilled).toBe(false)
    }
  })

  it('menandai item non-arsip yang belum terpenuhi', () => {
    expect(buildClosureChecklist({ ...full, bastIssued: false }).complete).toBe(false)
    expect(buildClosureChecklist({ ...full, finalTerminPaid: false }).items[1].fulfilled).toBe(false)
    expect(
      buildClosureChecklist({ ...full, performanceBondReturned: false }).items[2].fulfilled,
    ).toBe(false)
  })
})

describe('helper pengujian', () => {
  it('gagal bila fungsi tidak melempar', () => {
    expect(() => code(() => 1)).toThrow('diharapkan melempar BusinessRuleError')
  })
})
