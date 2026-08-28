/**
 * Seed data contoh ERP Konsultan Lingkungan.
 *
 * Prinsip:
 * 1. REALISTIS — nama orang, klien, lokasi, dan jenis dokumen memakai kasus
 *    yang benar-benar ditemui konsultan lingkungan di Indonesia (nama fiktif).
 * 2. RELATIF — seluruh tanggal diturunkan dari `today` dengan date-fns supaya
 *    peringatan otomatis (H-3 tender, H-60 sertifikat, H+1 invoice overdue)
 *    benar-benar terpicu kapan pun seed dijalankan.
 * 3. IDEMPOTEN — data lama dihapus berurutan mengikuti relasi, lalu diisi ulang.
 */

import { addDays, addMonths, startOfDay, subDays, subMonths } from 'date-fns'
import { db } from '@/lib/db'
import { hashPassword } from '@/server/auth'

// Kata sandi seragam untuk semua akun uji coba (memenuhi aturan validatePassword).
const DEMO_PASSWORD = 'Lingkungan2026'

const today = startOfDay(new Date())
const thisYear = today.getFullYear()

/** Tanggal relatif terhadap hari ini; dipakai agar seed tidak pernah basi. */
const D = (days: number) => addDays(today, days)

// ------------------------------------------------------------------ HAPUS DATA
// Urutan penting: anak dulu, induk belakangan (sebagian sudah onDelete: Cascade,
// tapi dihapus eksplisit supaya seed tetap aman bila skema berubah).
async function resetDatabase() {
  await db.notificationRecipient.deleteMany()
  await db.notification.deleteMany()
  await db.auditLog.deleteMany()
  await db.approval.deleteMany()
  await db.invoice.deleteMany()
  await db.termin.deleteMany()
  await db.costEntry.deleteMany()
  await db.deliverable.deleteMany()
  await db.labSample.deleteMany()
  await db.assignment.deleteMany()
  await db.kpiEvaluation.deleteMany()
  await db.bast.deleteMany()
  await db.csatSurvey.deleteMany()
  await db.contract.deleteMany()
  await db.manpowerRequest.deleteMany()
  await db.certification.deleteMany()
  await db.personnel.deleteMany()
  await db.project.deleteMany()
  await db.tender.deleteMany()
  await db.client.deleteMany()
  await db.user.deleteMany()
}

// ------------------------------------------------------------------- PENGGUNA

interface UserSeed {
  email: string
  name: string
  role: string
  division: string
  isActive?: boolean
  jabatan: string
}

const USER_SEEDS: UserSeed[] = [
  {
    email: 'bambang.sutrisno@hijaunusantara.co.id',
    name: 'Ir. Bambang Sutrisno, M.T.',
    role: 'DIREKTUR',
    division: 'MANAJEMEN',
    jabatan: 'Direktur Utama',
  },
  {
    email: 'hendra.gunawan@hijaunusantara.co.id',
    name: 'Hendra Gunawan, M.Si.',
    role: 'PROJECT_MANAGER',
    division: 'MANAJEMEN',
    jabatan: 'Manajer Mutu / Wakil Manajemen',
  },
  {
    email: 'tri.wahyuni@hijaunusantara.co.id',
    name: 'Tri Wahyuni, S.A.B.',
    role: 'STAFF',
    division: 'MANAJEMEN',
    jabatan: 'Sekretariat & Dokumen Kendali',
  },
  {
    email: 'retno.wulandari@hijaunusantara.co.id',
    name: 'Dra. Retno Wulandari, Ak.',
    role: 'FINANCE_MANAGER',
    division: 'FINANCE',
    jabatan: 'Finance Manager',
  },
  {
    // Administrator sistem: mengurus akun, bukan mengurus pekerjaan.
    email: 'admin@hijaunusantara.co.id',
    name: 'Adm. Sistem Hijau Nusantara',
    role: 'SUPERADMIN',
    division: 'SISTEM',
    jabatan: 'Administrator Sistem',
  },
  {
    email: 'maya.kusuma@hijaunusantara.co.id',
    name: 'Maya Kusumawardani, S.E.',
    role: 'STAFF',
    division: 'FINANCE',
    jabatan: 'Staf Akuntansi & Penagihan',
  },
  {
    email: 'andi.prasetyo@hijaunusantara.co.id',
    name: 'Andi Prasetyo, S.T., M.Ling.',
    role: 'PROJECT_MANAGER',
    division: 'TEKNIS',
    jabatan: 'Project Manager / Ketua Tim Penyusun AMDAL',
  },
  {
    email: 'siti.nurhaliza@hijaunusantara.co.id',
    name: 'Siti Nurhaliza Dewi, S.T.',
    role: 'PROJECT_MANAGER',
    division: 'TEKNIS',
    jabatan: 'Project Manager UKL-UPL',
  },
  {
    email: 'yudi.hermawan@hijaunusantara.co.id',
    name: 'Yudi Hermawan, S.Si.',
    role: 'STAFF',
    division: 'TEKNIS',
    jabatan: 'Ahli Kualitas Udara & Kebisingan',
  },
  {
    email: 'bagus.setiawan@hijaunusantara.co.id',
    name: 'Bagus Setiawan, A.Md.',
    role: 'STAFF',
    division: 'TEKNIS',
    isActive: false, // mantan surveyor; akun dinonaktifkan, seluruh akses dicabut
    jabatan: 'Surveyor Lapangan (nonaktif)',
  },
  {
    email: 'rizky.ramadhan@hijaunusantara.co.id',
    name: 'Rizky Ramadhan, S.T.',
    role: 'STAFF',
    division: 'MARKETING',
    jabatan: 'Staf Pemasaran & Tender',
  },
  {
    email: 'dewi.anggraini@hijaunusantara.co.id',
    name: 'Dewi Anggraini, S.I.Kom.',
    role: 'STAFF',
    division: 'MARKETING',
    jabatan: 'Business Development',
  },
  {
    email: 'fajar.nugroho@hijaunusantara.co.id',
    name: 'Fajar Nugroho, S.H.',
    role: 'STAFF',
    division: 'ADMIN_LEGAL',
    jabatan: 'Staf Administrasi & Legal Kontrak',
  },
  {
    email: 'nur.aisyah@hijaunusantara.co.id',
    name: 'Nur Aisyah Rahmani, S.Psi.',
    role: 'STAFF',
    division: 'HR',
    jabatan: 'Staf HR & Rekrutmen',
  },
]

async function seedUsers() {
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const users: Record<string, { id: string; name: string; email: string }> = {}
  for (const seed of USER_SEEDS) {
    const created = await db.user.create({
      data: {
        email: seed.email,
        name: seed.name,
        passwordHash,
        role: seed.role,
        division: seed.division,
        isActive: seed.isActive ?? true,
      },
    })
    users[seed.email] = created
  }
  return users
}

// --------------------------------------------------------------------- KLIEN

const CLIENT_SEEDS = [
  {
    key: 'sinar',
    name: 'PT Sinar Nusantara Energi',
    contactPerson: 'Ir. Wahyu Setiabudi',
    email: 'procurement@sinarnusantaraenergi.co.id',
    phone: '021-52998740',
    address: 'Gedung Menara Kencana Lt. 14, Jl. Jend. Sudirman Kav. 21, Jakarta Selatan',
  },
  {
    key: 'bumi',
    name: 'PT Bumi Lestari Sawit Kalimantan',
    contactPerson: 'Hasanuddin Lubis',
    email: 'hse@bumilestarisawit.co.id',
    phone: '0561-7745120',
    address: 'Jl. Ahmad Yani No. 88, Pontianak, Kalimantan Barat',
  },
  {
    key: 'dlh',
    name: 'Dinas Lingkungan Hidup Kabupaten Bandung',
    contactPerson: 'Drs. Endang Suryana, M.Si.',
    email: 'pengadaan@dlh.bandungkab.go.id',
    phone: '022-5891055',
    address: 'Komplek Pemkab Bandung, Jl. Raya Soreang Km. 17, Soreang',
  },
  {
    key: 'ciptabaja',
    name: 'PT Cipta Karya Baja Semesta',
    contactPerson: 'Ratna Mulyani, S.T.',
    email: 'ehs@ciptakaryabaja.co.id',
    phone: '0254-398112',
    address: 'Kawasan Industri Krakatau, Jl. Amerika I No. 5, Cilegon, Banten',
  },
  {
    key: 'samudra',
    name: 'PT Samudra Biru Perikanan Nusantara',
    contactPerson: 'Andi Baso Mappanyukki',
    email: 'legal@samudrabiru.co.id',
    phone: '0411-873990',
    address: 'Jl. Nusantara Baru No. 112, Kawasan Pelabuhan Soekarno-Hatta, Makassar',
  },
  {
    key: 'tirta',
    name: 'Perumda Air Minum Tirta Wening Surabaya',
    contactPerson: 'Ir. Sulistyowati, M.T.',
    email: 'pengadaan@tirtawening-sby.co.id',
    phone: '031-2996611',
    address: 'Jl. Mayjen Prof. Dr. Moestopo No. 2, Surabaya, Jawa Timur',
  },
]

async function seedClients() {
  const clients: Record<string, { id: string; name: string }> = {}
  for (const seed of CLIENT_SEEDS) {
    const { key, ...data } = seed
    clients[key] = await db.client.create({ data })
  }
  return clients
}

// -------------------------------------------------------------------- TENDER

async function seedTenders(clients: Record<string, { id: string }>) {
  // Tender 1 — sedang disiapkan, tenggat masih lega.
  const preparing = await db.tender.create({
    data: {
      code: `TND-${thisYear}-001`,
      title: 'Penyusunan Dokumen AMDAL Pembangunan PLTU Mulut Tambang Kapasitas 2x150 MW',
      clientId: clients.sinar.id,
      source: 'SWASTA',
      description:
        'Kajian AMDAL untuk rencana PLTU mulut tambang di Kabupaten Muara Enim, Sumatera Selatan.',
      torSummary:
        'Lingkup: rona lingkungan hidup awal, prakiraan dampak penting, RKL-RPL, sidang komisi provinsi.',
      estimatedValue: '1850000000.00',
      bidValue: '1795000000.00',
      winRateProbability: 70,
      submissionDeadline: D(21),
      status: 'PREPARING',
    },
  })

  // Tender 2 — tenggat 2 hari lagi supaya notifikasi H-3 dan H-1 terpicu.
  const urgent = await db.tender.create({
    data: {
      code: `TND-${thisYear}-002`,
      title: 'Jasa Konsultansi Penyusunan DELH Instalasi Pengolahan Air Limbah Terpadu',
      clientId: clients.tirta.id,
      source: 'LPSE',
      description:
        'Pekerjaan sudah berjalan tanpa dokumen lingkungan sehingga wajib disusun DELH.',
      torSummary: 'Lingkup: audit kondisi eksisting IPAL, evaluasi pemenuhan baku mutu, dokumen DELH.',
      estimatedValue: '420000000.00',
      bidValue: '398500000.00',
      winRateProbability: 65,
      submissionDeadline: D(2), // H-3/H-1 aktif
      status: 'PREPARING',
    },
  })

  // Tender 3 — sudah dikirim, menunggu pengumuman.
  const submitted = await db.tender.create({
    data: {
      code: `TND-${thisYear}-003`,
      title: 'Penyusunan UKL-UPL Pengembangan Terminal Peti Kemas Perikanan',
      clientId: clients.samudra.id,
      source: 'BUMN',
      description: 'Pengembangan dermaga dan cold storage di kawasan pelabuhan Makassar.',
      torSummary: 'Lingkup: UKL-UPL, kajian kualitas air laut, sosial ekonomi nelayan sekitar.',
      estimatedValue: '640000000.00',
      bidValue: '612000000.00',
      winRateProbability: 60,
      submissionDeadline: subDays(today, 6),
      announcementDate: D(12),
      status: 'SUBMITTED',
    },
  })

  // Tender 4 — KALAH. Biaya Pola 1 tetap tercatat sebagai beban operasional.
  const lost = await db.tender.create({
    data: {
      code: `TND-${thisYear}-004`,
      title: 'Penyusunan Dokumen AMDAL Jalan Tol Lingkar Selatan Ruas Seksi 2',
      clientId: clients.dlh.id,
      source: 'LPSE',
      description: 'Kalah harga terhadap konsorsium pesaing; biaya penyiapan dokumen hangus.',
      torSummary: 'Lingkup: AMDAL jalan tol sepanjang 24 km beserta kajian pembebasan lahan.',
      estimatedValue: '2100000000.00',
      bidValue: '2045000000.00',
      winRateProbability: 62,
      submissionDeadline: subDays(today, 75),
      announcementDate: subDays(today, 40),
      status: 'LOST',
    },
  })

  // Tender 5 & 6 — MENANG, sudah dikonversi menjadi proyek.
  const wonRunning = await db.tender.create({
    data: {
      code: `TND-${thisYear}-005`,
      title: 'Penyusunan Dokumen AMDAL Perluasan Pabrik Baja Lembaran Panas',
      clientId: clients.ciptabaja.id,
      source: 'SWASTA',
      description: 'Perluasan lini produksi hot rolled coil di Kawasan Industri Krakatau, Cilegon.',
      torSummary: 'Lingkup: AMDAL perluasan pabrik, kajian emisi cerobong, sidang komisi provinsi Banten.',
      estimatedValue: '1650000000.00',
      bidValue: '1580000000.00',
      winRateProbability: 78,
      submissionDeadline: subDays(today, 150),
      announcementDate: subDays(today, 128),
      status: 'WON',
    },
  })

  const wonClosed = await db.tender.create({
    data: {
      code: `TND-${thisYear - 1}-018`,
      title: 'Penyusunan Dokumen UKL-UPL Perkebunan dan Pabrik Kelapa Sawit Blok Ketapang',
      clientId: clients.bumi.id,
      source: 'PENUNJUKAN_LANGSUNG',
      description: 'Proyek telah selesai, BAST ditandatangani dan CSAT sudah diisi klien.',
      torSummary: 'Lingkup: UKL-UPL kebun inti 4.500 ha dan pabrik kelapa sawit kapasitas 45 ton TBS/jam.',
      estimatedValue: '760000000.00',
      bidValue: '735000000.00',
      winRateProbability: 85,
      submissionDeadline: subMonths(today, 14),
      announcementDate: subMonths(today, 13),
      status: 'WON',
    },
  })

  return { preparing, urgent, submitted, lost, wonRunning, wonClosed }
}

// -------------------------------------------------------------------- PROYEK

async function seedProjects(
  clients: Record<string, { id: string }>,
  tenders: Awaited<ReturnType<typeof seedTenders>>,
  users: Record<string, { id: string }>,
) {
  const pmAndi = users['andi.prasetyo@hijaunusantara.co.id'].id
  const pmSiti = users['siti.nurhaliza@hijaunusantara.co.id'].id

  // P1 — baru kontrak (PREPARATION), turunan tender yang menang.
  const kickoff = await db.project.create({
    data: {
      code: `JO-${thisYear}-011`,
      name: 'AMDAL Perluasan Pabrik Baja Lembaran Panas — PT Cipta Karya Baja Semesta',
      clientId: clients.ciptabaja.id,
      tenderId: tenders.wonRunning.id,
      projectManagerId: pmAndi,
      documentType: 'AMDAL',
      contractValue: '1580000000.00',
      startDate: subDays(today, 10),
      endDate: addMonths(today, 8),
      status: 'PREPARATION',
    },
  })

  // P2 — sedang survei lapangan (RUNNING).
  const fieldwork = await db.project.create({
    data: {
      code: `JO-${thisYear}-007`,
      name: 'AMDAL Pembangunan Bendungan dan Jaringan Irigasi Cisokan Hulu',
      clientId: clients.dlh.id,
      projectManagerId: pmAndi,
      documentType: 'AMDAL',
      contractValue: '1240000000.00',
      startDate: subMonths(today, 3),
      endDate: addMonths(today, 5),
      status: 'RUNNING',
    },
  })

  // P3 — tahap draft laporan (REPORTING).
  const drafting = await db.project.create({
    data: {
      code: `JO-${thisYear}-004`,
      name: 'UKL-UPL Pengembangan Dermaga Curah Cair dan Tangki Timbun Cilegon',
      clientId: clients.ciptabaja.id,
      projectManagerId: pmSiti,
      documentType: 'UKL_UPL',
      contractValue: '585000000.00',
      startDate: subMonths(today, 5),
      // Kontrak berakhir 25 hari lagi -> notifikasi Contract Expiry H-30 aktif.
      endDate: D(25),
      status: 'REPORTING',
    },
  })

  // P4 — mendekati BAST (CLOSING).
  const closing = await db.project.create({
    data: {
      code: `JO-${thisYear}-002`,
      name: 'DELH Instalasi Pengolahan Air Limbah Kawasan Industri Rancaekek',
      clientId: clients.dlh.id,
      projectManagerId: pmSiti,
      documentType: 'DELH',
      contractValue: '470000000.00',
      startDate: subMonths(today, 7),
      endDate: D(12),
      status: 'CLOSING',
    },
  })

  // P5 — sudah selesai (CLOSED), lengkap dengan BAST dan CSAT.
  const closed = await db.project.create({
    data: {
      code: `JO-${thisYear - 1}-021`,
      name: 'UKL-UPL Perkebunan dan Pabrik Kelapa Sawit Blok Ketapang',
      clientId: clients.bumi.id,
      tenderId: tenders.wonClosed.id,
      projectManagerId: pmSiti,
      documentType: 'UKL_UPL',
      contractValue: '735000000.00',
      startDate: subMonths(today, 12),
      endDate: subMonths(today, 2),
      status: 'CLOSED',
    },
  })

  return { kickoff, fieldwork, drafting, closing, closed }
}

// ------------------------------------------------------------------- KONTRAK

async function seedContracts(projects: Awaited<ReturnType<typeof seedProjects>>) {
  await db.contract.createMany({
    data: [
      {
        projectId: projects.kickoff.id,
        type: 'SPK',
        number: `SPK-CKBS/${thisYear}/0142`,
        signedAt: subDays(today, 10),
        validUntil: addMonths(today, 8),
        documentUrl: 'https://arsip.hijaunusantara.co.id/kontrak/SPK-CKBS-0142.pdf',
      },
      {
        projectId: projects.fieldwork.id,
        type: 'PKS',
        number: `PKS-DLHKB/${thisYear}/0089`,
        signedAt: subMonths(today, 3),
        validUntil: addMonths(today, 5),
      },
      {
        projectId: projects.drafting.id,
        type: 'SPK',
        number: `SPK-CKBS/${thisYear}/0071`,
        signedAt: subMonths(today, 5),
        validUntil: D(25),
      },
      {
        projectId: projects.drafting.id,
        type: 'ADDENDUM',
        number: `ADD-01/SPK-CKBS/${thisYear}/0071`,
        signedAt: subMonths(today, 1),
        validUntil: D(25),
      },
      {
        projectId: projects.closing.id,
        type: 'PKS',
        number: `PKS-DLHKB/${thisYear}/0033`,
        signedAt: subMonths(today, 7),
        validUntil: D(12),
      },
      {
        projectId: projects.closed.id,
        type: 'LOA',
        number: `LOA-BLSK/${thisYear - 1}/0204`,
        signedAt: subMonths(today, 12),
        validUntil: subMonths(today, 2),
      },
    ],
  })
}

// ------------------------------------------------------ BIAYA & PERSETUJUAN

async function seedCosts(
  tenders: Awaited<ReturnType<typeof seedTenders>>,
  projects: Awaited<ReturnType<typeof seedProjects>>,
  users: Record<string, { id: string }>,
) {
  const direktur = users['bambang.sutrisno@hijaunusantara.co.id'].id
  const financeManager = users['retno.wulandari@hijaunusantara.co.id'].id
  const marketing = users['rizky.ramadhan@hijaunusantara.co.id'].id
  const bizdev = users['dewi.anggraini@hijaunusantara.co.id'].id
  const pmAndi = users['andi.prasetyo@hijaunusantara.co.id'].id
  const pmSiti = users['siti.nurhaliza@hijaunusantara.co.id'].id

  /** Helper Pola 1: selalu menempel ke tender, tidak pernah ke proyek. */
  async function biddingCost(input: {
    tenderId: string
    category: string
    coaCode: string
    description: string
    amount: string
    incurredAt: Date
    requestedById: string
    status: string
    decisions?: { role: string; approverId: string; decision: string; note?: string; decidedAt: Date }[]
  }) {
    return db.costEntry.create({
      data: {
        pattern: 'BIDDING',
        tenderId: input.tenderId,
        projectId: null, // Pola 1 tidak pernah dibebankan ke proyek
        category: input.category,
        coaCode: input.coaCode,
        description: input.description,
        amount: input.amount,
        incurredAt: input.incurredAt,
        requestedById: input.requestedById,
        status: input.status,
        approvals: input.decisions ? { create: input.decisions } : undefined,
      },
    })
  }

  // --- Pola 1 pada tender yang KALAH: sudah disetujui dua peran, biaya hangus.
  await biddingCost({
    tenderId: tenders.lost.id,
    category: 'TENDER_DOCUMENT',
    coaCode: '6101',
    description: 'Pembelian dokumen lelang dan penggandaan dokumen penawaran AMDAL Tol Lingkar Selatan',
    amount: '7500000.00',
    incurredAt: subDays(today, 92),
    requestedById: marketing,
    status: 'APPROVED',
    decisions: [
      { role: 'DIREKTUR', approverId: direktur, decision: 'APPROVED', note: 'Peluang menang 62%, layak diikuti.', decidedAt: subDays(today, 90) },
      { role: 'FINANCE_MANAGER', approverId: financeManager, decision: 'APPROVED', note: 'Anggaran pemasaran tersedia.', decidedAt: subDays(today, 89) },
    ],
  })
  await biddingCost({
    tenderId: tenders.lost.id,
    category: 'BID_BOND',
    coaCode: '6102',
    description: 'Jaminan penawaran (bid bond) 1% dari nilai HPS, sudah dicairkan kembali',
    amount: '21000000.00',
    incurredAt: subDays(today, 88),
    requestedById: marketing,
    status: 'PAID',
    decisions: [
      { role: 'DIREKTUR', approverId: direktur, decision: 'APPROVED', decidedAt: subDays(today, 87) },
      { role: 'FINANCE_MANAGER', approverId: financeManager, decision: 'APPROVED', decidedAt: subDays(today, 87) },
    ],
  })
  await biddingCost({
    tenderId: tenders.lost.id,
    category: 'TRANSPORT_AUDIENCE',
    coaCode: '6104',
    description: 'Perjalanan dinas audiensi dan klarifikasi teknis ke Soreang (2 orang, 2 hari)',
    amount: '4350000.00',
    incurredAt: subDays(today, 80),
    requestedById: bizdev,
    status: 'APPROVED',
    decisions: [
      { role: 'DIREKTUR', approverId: direktur, decision: 'APPROVED', decidedAt: subDays(today, 79) },
      { role: 'FINANCE_MANAGER', approverId: financeManager, decision: 'APPROVED', decidedAt: subDays(today, 78) },
    ],
  })

  // --- Pola 1 masih menunggu persetujuan (Direktur sudah setuju, FM belum).
  await biddingCost({
    tenderId: tenders.preparing.id,
    category: 'ADMIN_LEGAL_NOTARY',
    coaCode: '6103',
    description: 'Legalisir akta dan pembuatan surat kuasa notaris untuk berkas administrasi tender PLTU',
    amount: '3200000.00',
    incurredAt: subDays(today, 4),
    requestedById: marketing,
    status: 'PENDING_APPROVAL',
    decisions: [
      { role: 'DIREKTUR', approverId: direktur, decision: 'APPROVED', note: 'Silakan lanjut.', decidedAt: subDays(today, 3) },
      { role: 'FINANCE_MANAGER', approverId: financeManager, decision: 'PENDING', decidedAt: subDays(today, 3) },
    ],
  })

  // --- Pola 1 DITOLAK: Finance Manager menilai nilai tidak sebanding.
  await biddingCost({
    tenderId: tenders.urgent.id,
    category: 'TRANSPORT_AUDIENCE',
    coaCode: '6104',
    description: 'Sewa kendaraan dan akomodasi tim ke Surabaya untuk aanwijzing lapangan DELH IPAL',
    amount: '9800000.00',
    incurredAt: subDays(today, 5),
    requestedById: bizdev,
    status: 'REJECTED',
    decisions: [
      { role: 'DIREKTUR', approverId: direktur, decision: 'APPROVED', decidedAt: subDays(today, 4) },
      {
        role: 'FINANCE_MANAGER',
        approverId: financeManager,
        decision: 'REJECTED',
        note: 'Nilai tender hanya Rp398 juta; aanwijzing cukup diikuti daring.',
        decidedAt: subDays(today, 4),
      },
    ],
  })

  // --- Pola 1 pada tender yang sudah dikirim, disetujui penuh.
  await biddingCost({
    tenderId: tenders.submitted.id,
    category: 'TENDER_DOCUMENT',
    coaCode: '6101',
    description: 'Penggandaan dan penjilidan dokumen penawaran UKL-UPL Terminal Peti Kemas Perikanan',
    amount: '2750000.00',
    incurredAt: subDays(today, 14),
    requestedById: marketing,
    status: 'APPROVED',
    decisions: [
      { role: 'DIREKTUR', approverId: direktur, decision: 'APPROVED', decidedAt: subDays(today, 13) },
      { role: 'FINANCE_MANAGER', approverId: financeManager, decision: 'APPROVED', decidedAt: subDays(today, 12) },
    ],
  })

  /** Helper Pola 2: direct cost per Job Order, tidak pernah menempel ke tender. */
  const projectCost = (input: {
    projectId: string
    category: string
    coaCode: string
    description: string
    amount: string
    incurredAt: Date
    requestedById: string
    status: string
  }) =>
    db.costEntry.create({
      data: {
        pattern: 'PROJECT',
        tenderId: null,
        projectId: input.projectId,
        category: input.category,
        coaCode: input.coaCode,
        description: input.description,
        amount: input.amount,
        incurredAt: input.incurredAt,
        requestedById: input.requestedById,
        status: input.status,
      },
    })

  // --- Pola 2 proyek survei lapangan (JO-007).
  await projectCost({
    projectId: projects.fieldwork.id,
    category: 'MOBILIZATION_DEMOBILIZATION',
    coaCode: '5102',
    description: 'Mobilisasi tim survei rona awal ke Cianjur (7 orang, 6 hari) termasuk sewa kendaraan 4WD',
    amount: '38500000.00',
    incurredAt: subDays(today, 45),
    requestedById: pmAndi,
    status: 'PAID',
  })
  await projectCost({
    projectId: projects.fieldwork.id,
    category: 'LAB_TEST_KAN',
    coaCode: '5103',
    description: 'Uji laboratorium terakreditasi KAN: 12 titik air permukaan, 6 titik udara ambien',
    amount: '64200000.00',
    incurredAt: subDays(today, 30),
    requestedById: pmAndi,
    status: 'APPROVED',
  })
  await projectCost({
    projectId: projects.fieldwork.id,
    category: 'EXPERT_HONORARIUM',
    coaCode: '5101',
    description: 'Honorarium tenaga ahli hidrologi dan ahli biologi (2 orang, 2 bulan)',
    amount: '52000000.00',
    incurredAt: subDays(today, 20),
    requestedById: pmAndi,
    status: 'APPROVED',
  })
  await projectCost({
    projectId: projects.fieldwork.id,
    category: 'SECONDARY_DATA_IMAGERY',
    coaCode: '5104',
    description: 'Pembelian citra satelit resolusi tinggi dan data BMKG untuk analisis iklim mikro',
    amount: '12750000.00',
    incurredAt: subDays(today, 7),
    requestedById: pmAndi,
    status: 'PENDING_APPROVAL', // belum jadi HPP sampai disetujui
  })

  // --- Pola 2 proyek draft laporan (JO-004).
  await projectCost({
    projectId: projects.drafting.id,
    category: 'LAB_TEST_KAN',
    coaCode: '5103',
    description: 'Uji kualitas air laut dan sedimen 8 titik di perairan Cilegon',
    amount: '29400000.00',
    incurredAt: subMonths(today, 3),
    requestedById: pmSiti,
    status: 'PAID',
  })
  await projectCost({
    projectId: projects.drafting.id,
    category: 'PROJECT_OVERHEAD',
    coaCode: '5106',
    description: 'Cetak dan penjilidan draft dokumen UKL-UPL 15 eksemplar untuk pembahasan',
    amount: '6800000.00',
    incurredAt: subDays(today, 12),
    requestedById: pmSiti,
    status: 'APPROVED',
  })
  await projectCost({
    projectId: projects.drafting.id,
    category: 'COMMISSION_HEARING',
    coaCode: '5105',
    description: 'Biaya rapat pembahasan tim teknis (konsumsi, ruang rapat, honor narasumber)',
    amount: '18250000.00',
    incurredAt: subDays(today, 2),
    requestedById: pmSiti,
    status: 'PENDING_APPROVAL',
  })

  // --- Pola 2 proyek menjelang BAST (JO-002).
  await projectCost({
    projectId: projects.closing.id,
    category: 'COMMISSION_HEARING',
    coaCode: '5105',
    description: 'Sidang komisi penilai dan penerbitan Persetujuan Teknis DELH Rancaekek',
    amount: '22500000.00',
    incurredAt: subMonths(today, 1),
    requestedById: pmSiti,
    status: 'PAID',
  })
  await projectCost({
    projectId: projects.closing.id,
    category: 'EXPERT_HONORARIUM',
    coaCode: '5101',
    description: 'Honorarium ahli pengolahan air limbah untuk evaluasi kinerja IPAL eksisting',
    amount: '31000000.00',
    incurredAt: subMonths(today, 2),
    requestedById: pmSiti,
    status: 'PAID',
  })

  // --- Pola 2 proyek yang sudah CLOSED (JO-021 tahun lalu).
  await projectCost({
    projectId: projects.closed.id,
    category: 'MOBILIZATION_DEMOBILIZATION',
    coaCode: '5102',
    description: 'Mobilisasi tim survei ke Blok Ketapang, Kalimantan Barat (5 orang, 10 hari)',
    amount: '47800000.00',
    incurredAt: subMonths(today, 11),
    requestedById: pmSiti,
    status: 'PAID',
  })
  await projectCost({
    projectId: projects.closed.id,
    category: 'LAB_TEST_KAN',
    coaCode: '5103',
    description: 'Uji laboratorium air sungai, air limbah PKS, dan udara ambien (KAN terakreditasi)',
    amount: '55300000.00',
    incurredAt: subMonths(today, 10),
    requestedById: pmSiti,
    status: 'PAID',
  })

  // --- Pola 2 proyek yang baru kontrak (JO-011).
  await projectCost({
    projectId: projects.kickoff.id,
    category: 'PROJECT_OVERHEAD',
    coaCode: '5106',
    description: 'Rapat kick-off dan penyusunan Kerangka Acuan bersama pemrakarsa di Cilegon',
    amount: '9500000.00',
    incurredAt: subDays(today, 6),
    requestedById: pmAndi,
    status: 'PENDING_APPROVAL',
  })
}

// -------------------------------------------------------- TERMIN & INVOICE

async function seedTerminsAndInvoices(projects: Awaited<ReturnType<typeof seedProjects>>) {
  /**
   * Porsi termin selalu mengikuti batas SOP: I 20-30%, II 40-50%, III 20-30%,
   * total tepat 100%. Sisa pembulatan dilempar ke termin III.
   */
  async function terminSet(input: {
    projectId: string
    contractValue: number
    percentages: [number, number, number]
    plannedDates: [Date, Date, Date]
    milestoneMetAt: [Date | null, Date | null, Date | null]
    statuses: [string, string, string]
  }) {
    const names = ['Termin I', 'Termin II', 'Termin III']
    const milestones = ['CONTRACT_SIGNED', 'DRAFT_REPORT', 'BAST']
    const amounts = input.percentages.map((p) =>
      Math.round((input.contractValue * p) / 100),
    )
    // Termin III menyerap selisih pembulatan agar total persis nilai kontrak.
    amounts[2] = input.contractValue - amounts[0] - amounts[1]

    const rows = []
    for (let i = 0; i < 3; i += 1) {
      rows.push(
        await db.termin.create({
          data: {
            projectId: input.projectId,
            sequence: i + 1,
            name: names[i],
            percentage: input.percentages[i].toFixed(2),
            amount: `${amounts[i]}.00`,
            milestone: milestones[i],
            milestoneMetAt: input.milestoneMetAt[i],
            plannedDate: input.plannedDates[i],
            status: input.statuses[i],
          },
        }),
      )
    }
    return rows
  }

  // JO-011 (baru kontrak): termin I siap ditagih, II & III menunggu.
  const kickoffTermins = await terminSet({
    projectId: projects.kickoff.id,
    contractValue: 1_580_000_000,
    percentages: [25, 50, 25],
    plannedDates: [D(5), addMonths(today, 4), addMonths(today, 8)],
    milestoneMetAt: [subDays(today, 10), null, null],
    statuses: ['READY_TO_INVOICE', 'PENDING', 'PENDING'],
  })

  // JO-007 (survei lapangan): termin I sudah lunas.
  const fieldworkTermins = await terminSet({
    projectId: projects.fieldwork.id,
    contractValue: 1_240_000_000,
    percentages: [30, 45, 25],
    plannedDates: [subMonths(today, 3), addMonths(today, 2), addMonths(today, 5)],
    milestoneMetAt: [subMonths(today, 3), null, null],
    statuses: ['PAID', 'PENDING', 'PENDING'],
  })

  // JO-004 (draft laporan): termin I lunas, termin II baru terbit dan
  // jatuh temponya 3 hari lagi -> notifikasi pre-due H-3 aktif.
  const draftingTermins = await terminSet({
    projectId: projects.drafting.id,
    contractValue: 585_000_000,
    percentages: [20, 50, 30],
    plannedDates: [subMonths(today, 5), subDays(today, 15), D(25)],
    milestoneMetAt: [subMonths(today, 5), subDays(today, 18), null],
    statuses: ['PAID', 'INVOICED', 'PENDING'],
  })

  // JO-002 (menjelang BAST): termin II jatuh tempo terlewat -> OVERDUE.
  const closingTermins = await terminSet({
    projectId: projects.closing.id,
    contractValue: 470_000_000,
    percentages: [25, 45, 30],
    plannedDates: [subMonths(today, 7), subMonths(today, 2), D(12)],
    milestoneMetAt: [subMonths(today, 7), subMonths(today, 2), null],
    statuses: ['PAID', 'INVOICED', 'PENDING'],
  })

  // JO-021 (CLOSED): tiga termin lunas seluruhnya.
  const closedTermins = await terminSet({
    projectId: projects.closed.id,
    contractValue: 735_000_000,
    percentages: [30, 40, 30],
    plannedDates: [subMonths(today, 12), subMonths(today, 6), subMonths(today, 2)],
    milestoneMetAt: [subMonths(today, 12), subMonths(today, 6), subMonths(today, 2)],
    statuses: ['PAID', 'PAID', 'PAID'],
  })

  await db.invoice.createMany({
    data: [
      // LUNAS — termin I proyek survei lapangan.
      {
        number: `INV/${thisYear}/0041`,
        terminId: fieldworkTermins[0].id,
        bapNumber: `BAP/DLHKB/${thisYear}/0089-1`,
        bapVerifiedAt: subMonths(today, 3),
        taxInvoiceNo: `010.004-${String(thisYear).slice(2)}.00000041`,
        amount: `${1_240_000_000 * 0.3}.00`,
        issuedAt: subMonths(today, 3),
        dueDate: subMonths(today, 2),
        paidAt: subDays(subMonths(today, 2), 3),
        status: 'PAID',
      },
      // LUNAS — termin I proyek draft laporan.
      {
        number: `INV/${thisYear}/0028`,
        terminId: draftingTermins[0].id,
        bapNumber: `BAP/CKBS/${thisYear}/0071-1`,
        bapVerifiedAt: subMonths(today, 5),
        taxInvoiceNo: `010.004-${String(thisYear).slice(2)}.00000028`,
        amount: `${585_000_000 * 0.2}.00`,
        issuedAt: subMonths(today, 5),
        dueDate: subMonths(today, 4),
        paidAt: subDays(subMonths(today, 4), 5),
        status: 'PAID',
      },
      // MENDEKATI JATUH TEMPO — H-3 notifikasi INVOICING/pre-due terpicu.
      {
        number: `INV/${thisYear}/0063`,
        terminId: draftingTermins[1].id,
        bapNumber: `BAP/CKBS/${thisYear}/0071-2`,
        bapVerifiedAt: subDays(today, 18),
        taxInvoiceNo: `010.004-${String(thisYear).slice(2)}.00000063`,
        amount: `${585_000_000 * 0.5}.00`,
        issuedAt: subDays(today, 16),
        dueDate: D(3),
        status: 'ISSUED',
      },
      // OVERDUE — sudah lewat 11 hari, notifikasi PAYMENT_OVERDUE aktif.
      {
        number: `INV/${thisYear}/0035`,
        terminId: closingTermins[1].id,
        bapNumber: `BAP/DLHKB/${thisYear}/0033-2`,
        bapVerifiedAt: subMonths(today, 2),
        taxInvoiceNo: `010.004-${String(thisYear).slice(2)}.00000035`,
        amount: `${470_000_000 * 0.45}.00`,
        issuedAt: subDays(today, 41),
        dueDate: subDays(today, 11),
        status: 'OVERDUE',
      },
      // Proyek CLOSED — ketiga invoice sudah lunas.
      {
        number: `INV/${thisYear - 1}/0102`,
        terminId: closedTermins[0].id,
        bapNumber: `BAP/BLSK/${thisYear - 1}/0204-1`,
        bapVerifiedAt: subMonths(today, 12),
        amount: `${735_000_000 * 0.3}.00`,
        issuedAt: subMonths(today, 12),
        dueDate: subMonths(today, 11),
        paidAt: subMonths(today, 11),
        status: 'PAID',
      },
      {
        number: `INV/${thisYear - 1}/0148`,
        terminId: closedTermins[1].id,
        bapNumber: `BAP/BLSK/${thisYear - 1}/0204-2`,
        bapVerifiedAt: subMonths(today, 6),
        amount: `${735_000_000 * 0.4}.00`,
        issuedAt: subMonths(today, 6),
        dueDate: subMonths(today, 5),
        paidAt: subMonths(today, 5),
        status: 'PAID',
      },
      {
        number: `INV/${thisYear}/0009`,
        terminId: closedTermins[2].id,
        bapNumber: `BAP/BLSK/${thisYear - 1}/0204-3`,
        bapVerifiedAt: subMonths(today, 2),
        amount: `${735_000_000 * 0.3}.00`,
        issuedAt: subMonths(today, 2),
        dueDate: subMonths(today, 1),
        paidAt: subDays(subMonths(today, 1), 4),
        status: 'PAID',
      },
    ],
  })

  // Termin I JO-011 sengaja belum diinvoice (menunggu BAP ditandatangani klien).
  void kickoffTermins

  return { kickoffTermins, fieldworkTermins, draftingTermins, closingTermins, closedTermins }
}

// ----------------------------------------------------- PERSONEL & SERTIFIKAT

async function seedPersonnel(users: Record<string, { id: string }>) {
  const personnel: Record<string, { id: string; fullName: string }> = {}

  async function create(
    key: string,
    data: {
      userEmail?: string
      fullName: string
      employmentType: string
      position: string
      expertise: string
      joinedAt: Date
      isActive?: boolean
      certifications: { name: string; issuer: string; number: string; issuedAt: Date; expiresAt: Date }[]
    },
  ) {
    const { userEmail, certifications, ...rest } = data
    personnel[key] = await db.personnel.create({
      data: {
        ...rest,
        isActive: data.isActive ?? true,
        userId: userEmail ? users[userEmail].id : null,
        certifications: { create: certifications },
      },
    })
  }

  // Ketua Tim Penyusun AMDAL — sertifikat lengkap, semua masih berlaku lama.
  await create('andi', {
    userEmail: 'andi.prasetyo@hijaunusantara.co.id',
    fullName: 'Andi Prasetyo, S.T., M.Ling.',
    employmentType: 'TETAP',
    position: 'Ketua Tim Penyusun AMDAL',
    expertise: 'Manajemen lingkungan, prakiraan dampak penting, RKL-RPL',
    joinedAt: subMonths(today, 74),
    certifications: [
      { name: 'KTPA', issuer: 'LSK INTAKINDO', number: 'KTPA-JB-002187', issuedAt: subMonths(today, 20), expiresAt: addMonths(today, 16) },
      { name: 'K3', issuer: 'Kemnaker RI', number: 'K3U-2021-44190', issuedAt: subMonths(today, 26), expiresAt: addMonths(today, 10) },
      { name: 'AMBIL_SAMPEL', issuer: 'LSP Lingkungan Hidup', number: 'PPC-2023-11804', issuedAt: subMonths(today, 16), expiresAt: addMonths(today, 20) },
      { name: 'SKK', issuer: 'LPJK', number: 'SKK-TL-556201', issuedAt: subMonths(today, 14), expiresAt: addMonths(today, 22) },
    ],
  })

  await create('siti', {
    userEmail: 'siti.nurhaliza@hijaunusantara.co.id',
    fullName: 'Siti Nurhaliza Dewi, S.T.',
    employmentType: 'TETAP',
    position: 'Anggota Tim Penyusun / PM UKL-UPL',
    expertise: 'Teknik lingkungan, pengolahan air limbah, dokumen UKL-UPL & DELH',
    joinedAt: subMonths(today, 52),
    certifications: [
      { name: 'ATPA', issuer: 'LSK INTAKINDO', number: 'ATPA-JB-004512', issuedAt: subMonths(today, 18), expiresAt: addMonths(today, 18) },
      { name: 'K3', issuer: 'Kemnaker RI', number: 'K3U-2022-51338', issuedAt: subMonths(today, 22), expiresAt: addMonths(today, 14) },
      { name: 'AMBIL_SAMPEL', issuer: 'LSP Lingkungan Hidup', number: 'PPC-2024-13097', issuedAt: subMonths(today, 9), expiresAt: addMonths(today, 27) },
    ],
  })

  // Sertifikat kedaluwarsa 45 hari lagi -> masuk ambang peringatan H-60.
  await create('yudi', {
    userEmail: 'yudi.hermawan@hijaunusantara.co.id',
    fullName: 'Yudi Hermawan, S.Si.',
    employmentType: 'TETAP',
    position: 'Ahli Kualitas Udara & Kebisingan',
    expertise: 'Pemantauan udara ambien, emisi cerobong, pemodelan dispersi',
    joinedAt: subMonths(today, 40),
    certifications: [
      { name: 'AMBIL_SAMPEL', issuer: 'LSP Lingkungan Hidup', number: 'PPC-2023-12275', issuedAt: subMonths(today, 33), expiresAt: D(45) },
      { name: 'K3', issuer: 'Kemnaker RI', number: 'K3U-2023-60411', issuedAt: subMonths(today, 15), expiresAt: addMonths(today, 21) },
    ],
  })

  await create('bagus', {
    userEmail: 'bagus.setiawan@hijaunusantara.co.id',
    fullName: 'Bagus Setiawan, A.Md.',
    employmentType: 'PKWT',
    position: 'Surveyor Lapangan',
    expertise: 'Pengukuran lapangan, dokumentasi rona awal',
    joinedAt: subMonths(today, 28),
    isActive: false, // kontrak PKWT berakhir dan tidak diperpanjang
    certifications: [
      { name: 'K3', issuer: 'Kemnaker RI', number: 'K3U-2022-49027', issuedAt: subMonths(today, 27), expiresAt: subDays(today, 20) },
    ],
  })

  // Tenaga ahli lepas — sertifikat lengkap, layak untuk proyek AMDAL.
  await create('gunawan', {
    fullName: 'Dr. Ir. Gunawan Hartono, M.Sc.',
    employmentType: 'FREELANCE_EXPERT',
    position: 'Tenaga Ahli Hidrologi & Kualitas Air',
    expertise: 'Hidrologi DAS, neraca air, pemodelan kualitas air permukaan',
    joinedAt: subMonths(today, 34),
    certifications: [
      { name: 'KTPA', issuer: 'LSK INTAKINDO', number: 'KTPA-DKI-001042', issuedAt: subMonths(today, 12), expiresAt: addMonths(today, 24) },
      { name: 'K3', issuer: 'Kemnaker RI', number: 'K3U-2024-70882', issuedAt: subMonths(today, 11), expiresAt: addMonths(today, 25) },
      { name: 'AMBIL_SAMPEL', issuer: 'LSP Lingkungan Hidup', number: 'PPC-2024-13541', issuedAt: subMonths(today, 10), expiresAt: addMonths(today, 26) },
      { name: 'SKK', issuer: 'LPJK', number: 'SKK-TL-601773', issuedAt: subMonths(today, 8), expiresAt: addMonths(today, 28) },
    ],
  })

  // Tenaga ahli lepas dengan sertifikat ATPA sudah kedaluwarsa -> tidak boleh
  // ditugaskan ke proyek AMDAL sampai diperpanjang.
  await create('ratna', {
    fullName: 'Ratna Puspita Sari, S.Si., M.Si.',
    employmentType: 'FREELANCE_EXPERT',
    position: 'Tenaga Ahli Biologi (Flora & Fauna)',
    expertise: 'Inventarisasi flora fauna, indeks keanekaragaman hayati',
    joinedAt: subMonths(today, 25),
    certifications: [
      { name: 'ATPA', issuer: 'LSK INTAKINDO', number: 'ATPA-JB-003890', issuedAt: subMonths(today, 38), expiresAt: subDays(today, 30) },
      { name: 'K3', issuer: 'Kemnaker RI', number: 'K3U-2023-66104', issuedAt: subMonths(today, 13), expiresAt: addMonths(today, 23) },
    ],
  })

  await create('fauzi', {
    fullName: 'Ahmad Fauzi, S.Sos., M.A.',
    employmentType: 'FREELANCE_EXPERT',
    position: 'Tenaga Ahli Sosial Ekonomi Budaya',
    expertise: 'Kajian sosekbud, persepsi masyarakat, konsultasi publik',
    joinedAt: subMonths(today, 19),
    certifications: [
      { name: 'SKK', issuer: 'LPJK', number: 'SKK-TL-588014', issuedAt: subMonths(today, 7), expiresAt: addMonths(today, 29) },
      { name: 'K3', issuer: 'Kemnaker RI', number: 'K3U-2024-73556', issuedAt: subMonths(today, 6), expiresAt: addMonths(today, 30) },
    ],
  })

  return personnel
}

// ------------------------------------------------------------- PENUGASAN & KPI

async function seedAssignmentsAndKpi(
  projects: Awaited<ReturnType<typeof seedProjects>>,
  personnel: Record<string, { id: string }>,
) {
  await db.assignment.createMany({
    data: [
      // AMDAL Cisokan — hanya personel dengan KTPA/ATPA, K3, AMBIL_SAMPEL, SKK aktif.
      { projectId: projects.fieldwork.id, personnelId: personnel.andi.id, role: 'Ketua Tim Penyusun', startDate: subMonths(today, 3) },
      { projectId: projects.fieldwork.id, personnelId: personnel.gunawan.id, role: 'Ahli Hidrologi', startDate: subMonths(today, 3), endDate: addMonths(today, 2) },
      { projectId: projects.fieldwork.id, personnelId: personnel.yudi.id, role: 'Ahli Kualitas Udara', startDate: subMonths(today, 2) },
      { projectId: projects.fieldwork.id, personnelId: personnel.fauzi.id, role: 'Ahli Sosial Ekonomi Budaya', startDate: subMonths(today, 2), endDate: addMonths(today, 1) },
      // AMDAL Cilegon — baru kontrak, tim inti sudah ditetapkan.
      { projectId: projects.kickoff.id, personnelId: personnel.andi.id, role: 'Ketua Tim Penyusun', startDate: subDays(today, 10) },
      { projectId: projects.kickoff.id, personnelId: personnel.yudi.id, role: 'Ahli Kualitas Udara', startDate: subDays(today, 8) },
      // UKL-UPL Cilegon.
      { projectId: projects.drafting.id, personnelId: personnel.siti.id, role: 'Ketua Tim Penyusun UKL-UPL', startDate: subMonths(today, 5) },
      { projectId: projects.drafting.id, personnelId: personnel.ratna.id, role: 'Ahli Biologi Perairan', startDate: subMonths(today, 4), endDate: subMonths(today, 1) },
      // DELH Rancaekek.
      { projectId: projects.closing.id, personnelId: personnel.siti.id, role: 'Penanggung Jawab Teknis', startDate: subMonths(today, 7) },
      { projectId: projects.closing.id, personnelId: personnel.gunawan.id, role: 'Ahli Kualitas Air', startDate: subMonths(today, 6), endDate: subMonths(today, 1) },
      // UKL-UPL Ketapang (CLOSED).
      { projectId: projects.closed.id, personnelId: personnel.siti.id, role: 'Ketua Tim Penyusun UKL-UPL', startDate: subMonths(today, 12), endDate: subMonths(today, 2) },
      { projectId: projects.closed.id, personnelId: personnel.fauzi.id, role: 'Ahli Sosial Ekonomi Budaya', startDate: subMonths(today, 11), endDate: subMonths(today, 4) },
    ],
  })

  // Bobot KPI: ketepatan waktu 0.35, kualitas 0.4, kerjasama 0.25.
  const weighted = (p: number, q: number, t: number) =>
    (Math.round((p * 0.35 + q * 0.4 + t * 0.25) * 100) / 100).toFixed(2)

  await db.kpiEvaluation.createMany({
    data: [
      // Karyawan tetap: evaluasi TAHUNAN.
      {
        personnelId: personnel.andi.id,
        periodType: 'ANNUAL',
        periodYear: thisYear - 1,
        punctualityScore: 90,
        qualityScore: 93,
        teamworkScore: 88,
        totalScore: weighted(90, 93, 88),
        note: 'Konsisten memimpin sidang komisi tanpa temuan mayor.',
        evaluatedAt: subMonths(today, 7),
      },
      {
        personnelId: personnel.siti.id,
        periodType: 'ANNUAL',
        periodYear: thisYear - 1,
        punctualityScore: 85,
        qualityScore: 88,
        teamworkScore: 92,
        totalScore: weighted(85, 88, 92),
        note: 'Pengendalian dokumen rapi, perlu tingkatkan kecepatan revisi draft.',
        evaluatedAt: subMonths(today, 7),
      },
      {
        personnelId: personnel.yudi.id,
        periodType: 'ANNUAL',
        periodYear: thisYear - 1,
        punctualityScore: 78,
        qualityScore: 84,
        teamworkScore: 80,
        totalScore: weighted(78, 84, 80),
        note: 'Data pemantauan udara akurat; laporan sering mepet tenggat.',
        evaluatedAt: subMonths(today, 7),
      },
      // Tenaga ahli lepas: evaluasi PER PROYEK.
      {
        personnelId: personnel.gunawan.id,
        projectId: projects.closing.id,
        periodType: 'PER_PROJECT',
        punctualityScore: 95,
        qualityScore: 96,
        teamworkScore: 90,
        totalScore: weighted(95, 96, 90),
        note: 'Analisis neraca air sangat membantu saat pembahasan tim teknis.',
        evaluatedAt: subMonths(today, 1),
      },
      {
        personnelId: personnel.fauzi.id,
        projectId: projects.closed.id,
        periodType: 'PER_PROJECT',
        punctualityScore: 82,
        qualityScore: 86,
        teamworkScore: 89,
        totalScore: weighted(82, 86, 89),
        note: 'Konsultasi publik berjalan lancar tanpa penolakan warga.',
        evaluatedAt: subMonths(today, 3),
      },
      {
        personnelId: personnel.ratna.id,
        projectId: projects.drafting.id,
        periodType: 'PER_PROJECT',
        punctualityScore: 68,
        qualityScore: 74,
        teamworkScore: 70,
        totalScore: weighted(68, 74, 70),
        note: 'Perlu perpanjangan sertifikat ATPA sebelum penugasan berikutnya.',
        evaluatedAt: subMonths(today, 1),
      },
    ],
  })
}

// ------------------------------------------------------- KEBUTUHAN PERSONEL

async function seedManpowerRequests(users: Record<string, { id: string }>) {
  const hr = users['nur.aisyah@hijaunusantara.co.id'].id
  const pmAndi = users['andi.prasetyo@hijaunusantara.co.id'].id
  const direktur = users['bambang.sutrisno@hijaunusantara.co.id'].id

  await db.manpowerRequest.createMany({
    data: [
      {
        formNumber: `F-HR-01/${thisYear}/007`,
        requestedById: pmAndi,
        position: 'Ahli Biologi (Flora & Fauna)',
        employmentType: 'FREELANCE_EXPERT',
        qualification: 'S2 Biologi/Ekologi, pengalaman minimal 5 proyek AMDAL',
        certifications: 'ATPA aktif, K3 Umum',
        quantity: 1,
        neededBy: D(30),
        status: 'SUBMITTED',
      },
      {
        formNumber: `F-HR-01/${thisYear}/006`,
        requestedById: pmAndi,
        position: 'Surveyor Lapangan',
        employmentType: 'PKWT',
        qualification: 'D3 Teknik Lingkungan/Geografi, bersedia dinas luar kota',
        certifications: 'K3 Umum, Pengambil Contoh Uji (AMBIL_SAMPEL)',
        quantity: 3,
        neededBy: D(45),
        status: 'APPROVED',
      },
      {
        formNumber: `F-HR-01/${thisYear}/005`,
        requestedById: hr,
        position: 'Staf Administrasi Proyek',
        employmentType: 'TETAP',
        qualification: 'D3/S1 Administrasi, menguasai pengendalian dokumen ISO 9001',
        certifications: 'Tidak ada sertifikasi khusus',
        quantity: 1,
        neededBy: D(60),
        status: 'FULFILLED',
      },
      {
        formNumber: `F-HR-01/${thisYear}/004`,
        requestedById: direktur,
        position: 'Ahli Pemodelan Dispersi Udara',
        employmentType: 'FREELANCE_EXPERT',
        qualification: 'S2 Teknik Lingkungan, menguasai AERMOD/CALPUFF',
        certifications: 'AMBIL_SAMPEL, K3 Umum',
        quantity: 1,
        neededBy: D(20),
        status: 'REJECTED',
      },
    ],
  })
}

// ------------------------------------------------- DELIVERABLE & SAMPEL LAB

async function seedTechnical(projects: Awaited<ReturnType<typeof seedProjects>>) {
  await db.deliverable.createMany({
    data: [
      // JO-011 baru kontrak: baru mulai studi meja.
      { projectId: projects.kickoff.id, type: 'DESK_STUDY', name: 'Kajian Data Sekunder & Penapisan Dampak Penting', dueDate: D(18), status: 'IN_PROGRESS' },
      { projectId: projects.kickoff.id, type: 'SAMPLING_PLAN', name: 'Rencana Pengambilan Sampel Rona Awal', dueDate: D(40), status: 'PENDING' },

      // JO-007 survei lapangan: studi meja & rencana sampling selesai,
      // draft laporan sedang disusun (dueDate 10 hari -> alert H-14 aktif).
      { projectId: projects.fieldwork.id, type: 'DESK_STUDY', name: 'Kajian Data Sekunder DAS Cisokan', dueDate: subMonths(today, 2), submittedAt: subMonths(today, 2), qcPassedAt: subDays(subMonths(today, 2), 4), status: 'APPROVED' },
      { projectId: projects.fieldwork.id, type: 'SAMPLING_PLAN', name: 'Rencana Sampling 18 Titik (Air, Udara, Tanah, Biota)', dueDate: subDays(today, 50), submittedAt: subDays(today, 52), qcPassedAt: subDays(today, 55), status: 'APPROVED' },
      { projectId: projects.fieldwork.id, type: 'DRAFT_REPORT', name: 'Draft ANDAL, RKL-RPL Bendungan Cisokan Hulu', dueDate: D(10), status: 'IN_PROGRESS' },

      // JO-004 draft laporan: draft sudah lolos QC dan diserahkan ke klien.
      { projectId: projects.drafting.id, type: 'DESK_STUDY', name: 'Kajian Data Sekunder Dermaga Curah Cair', dueDate: subMonths(today, 4), submittedAt: subMonths(today, 4), qcPassedAt: subDays(subMonths(today, 4), 3), status: 'APPROVED' },
      { projectId: projects.drafting.id, type: 'SAMPLING_PLAN', name: 'Rencana Sampling Kualitas Air Laut & Sedimen', dueDate: subMonths(today, 3), submittedAt: subMonths(today, 3), qcPassedAt: subDays(subMonths(today, 3), 2), status: 'APPROVED' },
      { projectId: projects.drafting.id, type: 'DRAFT_REPORT', name: 'Draft Dokumen UKL-UPL Dermaga Curah Cair', dueDate: subDays(today, 20), submittedAt: subDays(today, 18), qcPassedAt: subDays(today, 22), status: 'SUBMITTED' },
      { projectId: projects.drafting.id, type: 'EXPOSE', name: 'Paparan Pembahasan Tim Teknis DLH Provinsi Banten', dueDate: D(7), status: 'QC_REVIEW', qcPassedAt: subDays(today, 1) },
      { projectId: projects.drafting.id, type: 'FINAL_REPORT', name: 'Dokumen Final UKL-UPL Beserta Perbaikan Hasil Sidang', dueDate: D(21), status: 'PENDING' },

      // JO-002 menjelang BAST: laporan final sudah disetujui.
      { projectId: projects.closing.id, type: 'DESK_STUDY', name: 'Audit Kondisi Eksisting IPAL Rancaekek', dueDate: subMonths(today, 6), submittedAt: subMonths(today, 6), qcPassedAt: subDays(subMonths(today, 6), 3), status: 'APPROVED' },
      { projectId: projects.closing.id, type: 'SAMPLING_PLAN', name: 'Rencana Sampling Influen-Efluen IPAL', dueDate: subMonths(today, 5), submittedAt: subMonths(today, 5), qcPassedAt: subDays(subMonths(today, 5), 2), status: 'APPROVED' },
      { projectId: projects.closing.id, type: 'DRAFT_REPORT', name: 'Draft Dokumen DELH IPAL Rancaekek', dueDate: subMonths(today, 3), submittedAt: subMonths(today, 3), qcPassedAt: subDays(subMonths(today, 3), 4), status: 'APPROVED' },
      { projectId: projects.closing.id, type: 'EXPOSE', name: 'Paparan Sidang Komisi Penilai DELH', dueDate: subMonths(today, 2), submittedAt: subMonths(today, 2), qcPassedAt: subDays(subMonths(today, 2), 1), status: 'APPROVED' },
      { projectId: projects.closing.id, type: 'FINAL_REPORT', name: 'Dokumen Final DELH & Persetujuan Lingkungan', dueDate: subDays(today, 20), submittedAt: subDays(today, 22), qcPassedAt: subDays(today, 25), status: 'APPROVED' },

      // JO-021 CLOSED: seluruh tahapan APPROVED.
      { projectId: projects.closed.id, type: 'DESK_STUDY', name: 'Kajian Data Sekunder Blok Ketapang', dueDate: subMonths(today, 11), submittedAt: subMonths(today, 11), qcPassedAt: subDays(subMonths(today, 11), 3), status: 'APPROVED' },
      { projectId: projects.closed.id, type: 'SAMPLING_PLAN', name: 'Rencana Sampling Kebun Inti & PKS', dueDate: subMonths(today, 10), submittedAt: subMonths(today, 10), qcPassedAt: subDays(subMonths(today, 10), 2), status: 'APPROVED' },
      { projectId: projects.closed.id, type: 'DRAFT_REPORT', name: 'Draft UKL-UPL Perkebunan & PKS Ketapang', dueDate: subMonths(today, 7), submittedAt: subMonths(today, 7), qcPassedAt: subDays(subMonths(today, 7), 5), status: 'APPROVED' },
      { projectId: projects.closed.id, type: 'EXPOSE', name: 'Paparan Pembahasan DLH Kabupaten Ketapang', dueDate: subMonths(today, 5), submittedAt: subMonths(today, 5), qcPassedAt: subDays(subMonths(today, 5), 2), status: 'APPROVED' },
      { projectId: projects.closed.id, type: 'FINAL_REPORT', name: 'Dokumen Final UKL-UPL & Persetujuan Lingkungan', dueDate: subMonths(today, 3), submittedAt: subMonths(today, 3), qcPassedAt: subDays(subMonths(today, 3), 4), status: 'APPROVED' },
    ],
  })

  // Sampel lab lengkap dengan Chain of Custody dan laboratorium terakreditasi KAN.
  await db.labSample.createMany({
    data: [
      // JO-007 — sedang berjalan, status bertingkat.
      { projectId: projects.fieldwork.id, sampleCode: 'CSK-AIR-01', matrix: 'AIR', location: 'Sungai Cisokan, hulu rencana bendungan (S 6°58ʹ12ʺ, E 107°09ʹ45ʺ)', takenAt: subDays(today, 42), laboratory: 'PT Unilab Perdana (KAN LP-141-IDN)', cocNumber: `COC/${thisYear}/CSK-0011`, status: 'REPORTED', resultUrl: 'https://arsip.hijaunusantara.co.id/lab/CSK-AIR-01.pdf' },
      { projectId: projects.fieldwork.id, sampleCode: 'CSK-AIR-02', matrix: 'AIR', location: 'Sungai Cisokan, hilir rencana bendungan', takenAt: subDays(today, 42), laboratory: 'PT Unilab Perdana (KAN LP-141-IDN)', cocNumber: `COC/${thisYear}/CSK-0011`, status: 'REPORTED', resultUrl: 'https://arsip.hijaunusantara.co.id/lab/CSK-AIR-02.pdf' },
      { projectId: projects.fieldwork.id, sampleCode: 'CSK-UDR-01', matrix: 'UDARA', location: 'Permukiman Desa Cijenuk, radius 500 m dari tapak', takenAt: subDays(today, 40), laboratory: 'PT Sucofindo Laboratorium Bandung (KAN LP-013-IDN)', cocNumber: `COC/${thisYear}/CSK-0014`, status: 'TESTED' },
      { projectId: projects.fieldwork.id, sampleCode: 'CSK-TNH-01', matrix: 'TANAH', location: 'Area genangan rencana waduk, blok B2', takenAt: subDays(today, 38), laboratory: 'PT Sucofindo Laboratorium Bandung (KAN LP-013-IDN)', cocNumber: `COC/${thisYear}/CSK-0015`, status: 'SENT' },
      { projectId: projects.fieldwork.id, sampleCode: 'CSK-BIO-01', matrix: 'FLORA', location: 'Transek hutan sekunder tepi Sungai Cisokan', takenAt: subDays(today, 6), laboratory: 'Laboratorium Ekologi Universitas Padjadjaran', cocNumber: null, status: 'COLLECTED' },
      { projectId: projects.fieldwork.id, sampleCode: 'CSK-SOS-01', matrix: 'SOSEKBUD', location: 'Kuesioner 120 responden, 4 desa terdampak', takenAt: subDays(today, 25), laboratory: 'Internal — Tim Sosekbud', cocNumber: `COC/${thisYear}/CSK-0021`, status: 'REPORTED' },

      // JO-004 — seluruh sampel sudah dilaporkan.
      { projectId: projects.drafting.id, sampleCode: 'DCC-LAUT-01', matrix: 'AIR', location: 'Perairan dermaga eksisting, 200 m arah utara', takenAt: subMonths(today, 3), laboratory: 'PT Unilab Perdana (KAN LP-141-IDN)', cocNumber: `COC/${thisYear}/DCC-0004`, status: 'REPORTED', resultUrl: 'https://arsip.hijaunusantara.co.id/lab/DCC-LAUT-01.pdf' },
      { projectId: projects.drafting.id, sampleCode: 'DCC-SED-01', matrix: 'TANAH', location: 'Sedimen dasar perairan alur pelayaran', takenAt: subMonths(today, 3), laboratory: 'PT Unilab Perdana (KAN LP-141-IDN)', cocNumber: `COC/${thisYear}/DCC-0005`, status: 'REPORTED', resultUrl: 'https://arsip.hijaunusantara.co.id/lab/DCC-SED-01.pdf' },
      { projectId: projects.drafting.id, sampleCode: 'DCC-UDR-01', matrix: 'UDARA', location: 'Batas pagar kawasan tangki timbun', takenAt: subMonths(today, 3), laboratory: 'PT Sucofindo Laboratorium Cilegon (KAN LP-013-IDN)', cocNumber: `COC/${thisYear}/DCC-0006`, status: 'REPORTED', resultUrl: 'https://arsip.hijaunusantara.co.id/lab/DCC-UDR-01.pdf' },

      // JO-002 — arsip proyek yang hampir tutup.
      { projectId: projects.closing.id, sampleCode: 'RCK-EFL-01', matrix: 'AIR', location: 'Outlet IPAL kawasan industri Rancaekek', takenAt: subMonths(today, 5), laboratory: 'PT Unilab Perdana (KAN LP-141-IDN)', cocNumber: `COC/${thisYear}/RCK-0002`, status: 'REPORTED', resultUrl: 'https://arsip.hijaunusantara.co.id/lab/RCK-EFL-01.pdf' },
      { projectId: projects.closing.id, sampleCode: 'RCK-INF-01', matrix: 'AIR', location: 'Inlet IPAL kawasan industri Rancaekek', takenAt: subMonths(today, 5), laboratory: 'PT Unilab Perdana (KAN LP-141-IDN)', cocNumber: `COC/${thisYear}/RCK-0002`, status: 'REPORTED', resultUrl: 'https://arsip.hijaunusantara.co.id/lab/RCK-INF-01.pdf' },

      // JO-021 — arsip proyek yang sudah ditutup.
      { projectId: projects.closed.id, sampleCode: 'KTP-AIR-01', matrix: 'AIR', location: 'Sungai Pawan, hilir outlet land application PKS', takenAt: subMonths(today, 10), laboratory: 'PT Sucofindo Laboratorium Pontianak (KAN LP-013-IDN)', cocNumber: `COC/${thisYear - 1}/KTP-0031`, status: 'REPORTED', resultUrl: 'https://arsip.hijaunusantara.co.id/lab/KTP-AIR-01.pdf' },
      { projectId: projects.closed.id, sampleCode: 'KTP-UDR-01', matrix: 'UDARA', location: 'Permukiman karyawan PKS Blok Ketapang', takenAt: subMonths(today, 10), laboratory: 'PT Sucofindo Laboratorium Pontianak (KAN LP-013-IDN)', cocNumber: `COC/${thisYear - 1}/KTP-0032`, status: 'REPORTED', resultUrl: 'https://arsip.hijaunusantara.co.id/lab/KTP-UDR-01.pdf' },
    ],
  })
}

// ---------------------------------------------------------- BAST & CSAT

async function seedClosure(projects: Awaited<ReturnType<typeof seedProjects>>) {
  // Bobot CSAT: teknis 0.35, ketepatan waktu 0.25, komunikasi 0.20, administrasi 0.20.
  const csatWeighted = (tech: number, time: number, resp: number, comp: number) =>
    (Math.round((tech * 0.35 + time * 0.25 + resp * 0.2 + comp * 0.2) * 100) / 100).toFixed(2)

  await db.bast.create({
    data: {
      projectId: projects.closed.id,
      number: `BAST/BLSK/${thisYear}/007`,
      signedAt: subMonths(today, 2),
      permitNumber: `SK.660.1/${thisYear - 1}/DLH-KTP/0219`,
      documentUrl: 'https://arsip.hijaunusantara.co.id/bast/BAST-BLSK-007.pdf',
    },
  })

  await db.csatSurvey.create({
    data: {
      projectId: projects.closed.id,
      technicalScore: 92,
      timelinessScore: 85,
      responsivenessScore: 90,
      complianceScore: 88,
      weightedScore: csatWeighted(92, 85, 90, 88),
      comment:
        'Dokumen UKL-UPL diterima DLH tanpa revisi mayor. Komunikasi tim konsultan responsif, hanya jadwal survei lapangan sempat mundur satu minggu karena cuaca.',
      sentAt: subDays(subMonths(today, 2), -3),
      respondedAt: subDays(subMonths(today, 2), -10),
      status: 'COMPLETED',
    },
  })

  // Proyek CLOSING sudah dikirimi survei tapi klien belum mengisi.
  await db.csatSurvey.create({
    data: {
      projectId: projects.closing.id,
      status: 'PENDING',
    },
  })
}

// ------------------------------------------------------------------- CETAK

function printAccounts() {
  const pad = (value: string, width: number) => value.padEnd(width)
  console.log('\n================================================================================')
  console.log(`  AKUN UJI COBA — kata sandi seragam: ${DEMO_PASSWORD}`)
  console.log('================================================================================')
  console.log(
    `  ${pad('EMAIL', 44)}${pad('PERAN', 17)}${pad('DIVISI', 12)}STATUS`,
  )
  console.log('  ' + '-'.repeat(78))
  for (const user of USER_SEEDS) {
    console.log(
      `  ${pad(user.email, 44)}${pad(user.role, 17)}${pad(user.division, 12)}${
        user.isActive === false ? 'NONAKTIF' : 'aktif'
      }`,
    )
  }
  console.log('  ' + '-'.repeat(78))
  for (const user of USER_SEEDS) {
    console.log(`  ${pad(user.email.split('@')[0], 24)}${pad(user.name, 34)}${user.jabatan}`)
  }
  console.log('================================================================================\n')
}

// -------------------------------------------------------------------- MAIN

async function main() {
  console.log('> Membersihkan data lama...')
  await resetDatabase()

  console.log('> Menanam pengguna...')
  const users = await seedUsers()

  console.log('> Menanam klien...')
  const clients = await seedClients()

  console.log('> Menanam tender...')
  const tenders = await seedTenders(clients)

  console.log('> Menanam proyek dan kontrak...')
  const projects = await seedProjects(clients, tenders, users)
  await seedContracts(projects)

  console.log('> Menanam biaya Pola 1 & Pola 2 beserta persetujuan...')
  await seedCosts(tenders, projects, users)

  console.log('> Menanam termin dan invoice...')
  await seedTerminsAndInvoices(projects)

  console.log('> Menanam personel, sertifikasi, penugasan, dan KPI...')
  const personnel = await seedPersonnel(users)
  await seedAssignmentsAndKpi(projects, personnel)
  await seedManpowerRequests(users)

  console.log('> Menanam deliverable teknis dan sampel laboratorium...')
  await seedTechnical(projects)

  console.log('> Menanam BAST dan CSAT...')
  await seedClosure(projects)

  const counts = {
    pengguna: await db.user.count(),
    klien: await db.client.count(),
    tender: await db.tender.count(),
    proyek: await db.project.count(),
    kontrak: await db.contract.count(),
    biaya: await db.costEntry.count(),
    persetujuan: await db.approval.count(),
    termin: await db.termin.count(),
    invoice: await db.invoice.count(),
    personel: await db.personnel.count(),
    sertifikat: await db.certification.count(),
    penugasan: await db.assignment.count(),
    kpi: await db.kpiEvaluation.count(),
    formHr01: await db.manpowerRequest.count(),
    deliverable: await db.deliverable.count(),
    sampelLab: await db.labSample.count(),
    bast: await db.bast.count(),
    csat: await db.csatSurvey.count(),
  }

  console.log('\n> Ringkasan data:')
  for (const [key, value] of Object.entries(counts)) {
    console.log(`   - ${key.padEnd(14)}: ${value}`)
  }

  printAccounts()
  console.log('Seed selesai.')
}

main()
  .catch((error) => {
    console.error('Seed gagal:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
