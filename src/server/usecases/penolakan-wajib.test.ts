/**
 * SKENARIO 3 — Penolakan yang MEMANG HARUS terjadi.
 *
 * Empat gerbang SOP yang tidak boleh bisa dilewati: win rate di bawah 60%,
 * invoice tanpa BAP terverifikasi, penutupan proyek tanpa BAST, dan
 * penyerahan deliverable yang belum lolos QC internal.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    tender: { findUnique: vi.fn() },
    project: { findUnique: vi.fn(), update: vi.fn() },
    contract: { findMany: vi.fn() },
    bast: { findUnique: vi.fn() },
    costEntry: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    termin: { findUnique: vi.fn(), update: vi.fn() },
    invoice: { create: vi.fn() },
    deliverable: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    labSample: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { BusinessRuleError } from '@/server/shared/constants'
import { MIN_WIN_RATE_PROBABILITY, createBiddingCost, createProjectCost, issueInvoice } from '@/server/finance'
import {
  changeDeliverableStatus,
  changeLabSampleStatus,
  changeProjectStatus,
  changeTenderStatus,
  convertTenderToProject,
  issueBast,
} from '@/server/lifecycle'

type Fn = ReturnType<typeof vi.fn>
const mocked = db as unknown as Record<string, Record<string, Fn>>

const at = (iso: string) => new Date(iso)

/** Bantu memastikan galat yang dilempar benar-benar aturan bisnis, bukan galat lain. */
async function expectBusinessRule(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(BusinessRuleError)
  await promise.catch((error: BusinessRuleError) => expect(error.code).toBe(code))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Skenario: gerbang SOP menolak permintaan yang tidak memenuhi syarat', () => {
  it('menolak biaya tender karena probabilitas menang hanya 45% (di bawah ambang 60%)', async () => {
    mocked.tender.findUnique.mockResolvedValue({
      id: 'tnd-delh-ipal',
      winRateProbability: 45,
    })

    await expectBusinessRule(
      createBiddingCost({
        tenderId: 'tnd-delh-ipal',
        category: 'TRANSPORT_AUDIENCE',
        description: 'Sewa kendaraan dan akomodasi tim untuk aanwijzing lapangan di Surabaya',
        amount: '9800000',
        incurredAt: at('2026-03-10'),
        requestedById: 'usr-dewi-anggraini',
      }),
      'WIN_RATE_BELOW_THRESHOLD',
    )

    expect(MIN_WIN_RATE_PROBABILITY).toBe(60)
    expect(mocked.costEntry.create).not.toHaveBeenCalled()
  })

  it('menolak biaya tender pada tender yang belum pernah mengisi probabilitas menang', async () => {
    mocked.tender.findUnique.mockResolvedValue({
      id: 'tnd-belum-dikaji',
      winRateProbability: null,
    })

    await expectBusinessRule(
      createBiddingCost({
        tenderId: 'tnd-belum-dikaji',
        category: 'TENDER_DOCUMENT',
        description: 'Pembelian dokumen lelang sebelum kajian KAK selesai',
        amount: '3000000',
        incurredAt: at('2026-03-11'),
        requestedById: 'usr-rizky-ramadhan',
      }),
      'WIN_RATE_BELOW_THRESHOLD',
    )
  })

  it('menolak penerbitan invoice karena BAP belum diverifikasi klien', async () => {
    mocked.termin.findUnique.mockResolvedValue({
      id: 'termin-2',
      amount: '790000000.00',
      milestoneMetAt: at('2026-06-25'),
      invoice: null,
    })

    await expectBusinessRule(
      issueInvoice({
        terminId: 'termin-2',
        number: 'INV/2026/0063',
        bapNumber: 'BAP/CKBS/2026/0142-2',
        bapVerifiedAt: null, // BAP masih menunggu tanda tangan pemrakarsa
        issuedAt: at('2026-06-30'),
        dueDate: at('2026-07-30'),
      }),
      'INVOICE_BAP_NOT_VERIFIED',
    )

    expect(mocked.invoice.create).not.toHaveBeenCalled()
    expect(mocked.termin.update).not.toHaveBeenCalled()
  })

  it('menolak penerbitan invoice ketika milestone termin belum tercapai meski BAP sudah terverifikasi', async () => {
    mocked.termin.findUnique.mockResolvedValue({
      id: 'termin-3',
      amount: '395000000.00',
      milestoneMetAt: null, // BAST belum ditandatangani
      invoice: null,
    })

    await expectBusinessRule(
      issueInvoice({
        terminId: 'termin-3',
        number: 'INV/2026/0091',
        bapNumber: 'BAP/CKBS/2026/0142-3',
        bapVerifiedAt: at('2026-10-12'),
        issuedAt: at('2026-10-13'),
        dueDate: at('2026-11-12'),
      }),
      'INVOICE_MILESTONE_NOT_MET',
    )
  })

  it('menolak penutupan proyek karena BAST belum ditandatangani', async () => {
    mocked.project.findUnique.mockResolvedValue({ id: 'jo-2026-002', status: 'CLOSING' })
    mocked.contract.findMany.mockResolvedValue([{ type: 'PKS', signedAt: at('2026-01-05') }])
    mocked.bast.findUnique.mockResolvedValue(null)

    await expectBusinessRule(
      changeProjectStatus({ projectId: 'jo-2026-002', to: 'CLOSED' }),
      'PROJECT_BAST_REQUIRED',
    )

    expect(mocked.project.update).not.toHaveBeenCalled()
  })

  it('menolak penerbitan BAST karena laporan final belum berstatus APPROVED', async () => {
    mocked.deliverable.findFirst.mockResolvedValue({
      id: 'dlv-final',
      type: 'FINAL_REPORT',
      status: 'SUBMITTED',
    })

    await expectBusinessRule(
      issueBast({
        projectId: 'jo-2026-002',
        number: 'BAST/DLHKB/2026/003',
        signedAt: at('2026-09-01'),
      }),
      'BAST_FINAL_REPORT_REQUIRED',
    )
  })

  it('menolak deliverable disubmit karena belum lolos QC internal (qcPassedAt kosong)', async () => {
    mocked.deliverable.findUnique.mockResolvedValue({
      id: 'dlv-draft-ukl-upl',
      status: 'QC_REVIEW',
      qcPassedAt: null,
    })

    await expectBusinessRule(
      changeDeliverableStatus({
        deliverableId: 'dlv-draft-ukl-upl',
        to: 'SUBMITTED',
        now: at('2026-06-25'),
      }),
      'DELIVERABLE_QC_REQUIRED',
    )

    expect(mocked.deliverable.update).not.toHaveBeenCalled()
  })

  it('menolak deliverable melompati tahapan dari PENDING langsung ke SUBMITTED', async () => {
    mocked.deliverable.findUnique.mockResolvedValue({
      id: 'dlv-desk-study',
      status: 'PENDING',
      qcPassedAt: null,
    })

    await expectBusinessRule(
      changeDeliverableStatus({
        deliverableId: 'dlv-desk-study',
        to: 'SUBMITTED',
        now: at('2026-04-01'),
      }),
      'DELIVERABLE_INVALID_TRANSITION',
    )
  })

  it('menolak biaya Pola 2 sebelum kontrak/SPK ditandatangani', async () => {
    mocked.project.findUnique.mockResolvedValue({
      id: 'jo-2026-011',
      contracts: [], // baru menang, kontrak belum diteken
    })

    await expectBusinessRule(
      createProjectCost({
        projectId: 'jo-2026-011',
        category: 'MOBILIZATION_DEMOBILIZATION',
        description: 'Mobilisasi tim survei mendahului penandatanganan SPK',
        amount: '38500000',
        incurredAt: at('2026-02-10'),
        requestedById: 'usr-andi-prasetyo',
      }),
      'PROJECT_COST_REQUIRES_SIGNED_CONTRACT',
    )
  })

  it('menolak pengiriman sampel ke laboratorium tanpa nomor Chain of Custody', async () => {
    mocked.labSample.findUnique.mockResolvedValue({
      id: 'smp-csk-bio-01',
      status: 'COLLECTED',
      cocNumber: null,
      laboratory: 'Laboratorium Ekologi Universitas Padjadjaran',
    })

    await expectBusinessRule(
      changeLabSampleStatus({ labSampleId: 'smp-csk-bio-01', to: 'SENT' }),
      'LAB_SAMPLE_COC_REQUIRED',
    )
  })

  it('menolak penawaran disubmit setelah melewati batas waktu pemasukan LPSE', async () => {
    mocked.tender.findUnique.mockResolvedValue({
      id: 'tnd-terlambat',
      status: 'PREPARING',
      submissionDeadline: at('2026-03-01'),
    })

    await expectBusinessRule(
      changeTenderStatus({ tenderId: 'tnd-terlambat', to: 'SUBMITTED', now: at('2026-03-02') }),
      'TENDER_DEADLINE_PASSED',
    )
  })

  it('menolak konversi menjadi proyek untuk tender yang belum berstatus WON', async () => {
    mocked.tender.findUnique.mockResolvedValue({
      id: 'tnd-masih-submitted',
      clientId: 'cli-samudra-biru',
      status: 'SUBMITTED',
      bidValue: '612000000.00',
      estimatedValue: '640000000.00',
    })
    mocked.project.findUnique.mockResolvedValue(null)

    await expectBusinessRule(
      convertTenderToProject({
        tenderId: 'tnd-masih-submitted',
        code: 'JO-2026-012',
        name: 'UKL-UPL Terminal Peti Kemas Perikanan',
        documentType: 'UKL_UPL',
        startDate: at('2026-04-01'),
        endDate: at('2026-09-01'),
      }),
      'TENDER_NOT_WON',
    )
  })
})
