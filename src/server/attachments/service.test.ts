import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    attachment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { db } from '@/lib/db'
import {
  absolutePathFor,
  deleteAttachment,
  getAttachment,
  listAttachments,
  saveAttachment,
  storageRoot,
} from './service'

const create = vi.mocked(db.attachment.create)
const findMany = vi.mocked(db.attachment.findMany)
const findUnique = vi.mocked(db.attachment.findUnique)
const hapus = vi.mocked(db.attachment.delete)

const NOW = new Date('2026-08-28T10:00:00.000Z')

function masukan(over: Record<string, unknown> = {}) {
  return {
    entityType: 'Project',
    entityId: 'p1',
    originalName: 'Laporan.pdf',
    mimeType: 'application/pdf',
    bytes: new Uint8Array([1, 2, 3]),
    uploadedById: 'u1',
    now: NOW,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.UPLOAD_DIR = '/data/unggahan'
})

describe('lokasi penyimpanan', () => {
  it('memakai direktori dari konfigurasi', () => {
    expect(storageRoot()).toBe('/data/unggahan')
  })

  it('memakai direktori bawaan bila tidak dikonfigurasi', () => {
    delete process.env.UPLOAD_DIR
    expect(storageRoot().endsWith('storage/uploads')).toBe(true)
  })

  it('menolak jalur yang keluar dari akar penyimpanan', () => {
    // Penjagaan terakhir bila suatu saat jalur datang dari sumber lain.
    expect(() => absolutePathFor('../../etc/passwd')).toThrowError(/tidak sah/)
  })

  it('menerima jalur di dalam akar', () => {
    expect(absolutePathFor('2026/08/x.pdf')).toBe('/data/unggahan/2026/08/x.pdf')
  })
})

describe('saveAttachment', () => {
  it('menyimpan berkas lalu mencatatnya', async () => {
    create.mockResolvedValue({ id: 'a1' } as never)

    await saveAttachment(masukan())

    expect(mkdir).toHaveBeenCalledWith('/data/unggahan/2026/08', { recursive: true })
    expect(writeFile).toHaveBeenCalledOnce()

    const data = create.mock.calls[0][0].data as Record<string, unknown>
    expect(data.kind).toBe('DOKUMEN')
    expect(data.sizeBytes).toBe(3)
    // Nama di penyimpanan tidak mengandung nama kiriman pengguna.
    expect(String(data.storedPath)).toMatch(/^2026\/08\/[\w-]+\.pdf$/)
    expect(String(data.storedPath)).not.toContain('Laporan')
  })

  it('membersihkan nama kiriman sebelum disimpan sebagai label', async () => {
    create.mockResolvedValue({ id: 'a1' } as never)

    await saveAttachment(masukan({ originalName: '../../rahasia.pdf' }))

    const data = create.mock.calls[0][0].data as Record<string, unknown>
    expect(data.originalName).toBe('.-.-rahasia.pdf')
  })

  it('menyimpan keterangan bila diisi, dan null bila kosong', async () => {
    create.mockResolvedValue({ id: 'a1' } as never)

    await saveAttachment(masukan({ caption: '  Foto rona awal  ' }))
    expect((create.mock.calls[0][0].data as Record<string, unknown>).caption).toBe(
      'Foto rona awal',
    )

    await saveAttachment(masukan({ caption: '   ' }))
    expect((create.mock.calls[1][0].data as Record<string, unknown>).caption).toBeNull()

    await saveAttachment(masukan())
    expect((create.mock.calls[2][0].data as Record<string, unknown>).caption).toBeNull()
  })

  it('menolak sebelum menulis berkas bila entitasnya tidak sah', async () => {
    await expect(saveAttachment(masukan({ entityType: 'User' }))).rejects.toMatchObject({
      code: 'ENTITY_NOT_ATTACHABLE',
    })
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('menolak jenis berkas terlarang tanpa menyentuh disk', async () => {
    await expect(saveAttachment(masukan({ mimeType: 'text/html' }))).rejects.toMatchObject({
      code: 'FILE_TYPE_NOT_ALLOWED',
    })
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('menolak berkas terlalu besar tanpa menyentuh disk', async () => {
    await expect(
      saveAttachment(masukan({ bytes: new Uint8Array(11 * 1024 * 1024) })),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
    expect(writeFile).not.toHaveBeenCalled()
  })
})

describe('listAttachments', () => {
  it('mengembalikan lampiran terbaru lebih dulu', async () => {
    findMany.mockResolvedValue([] as never)

    await listAttachments('Tender', 't1')

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: 'Tender', entityId: 't1' },
        orderBy: { createdAt: 'desc' },
      }),
    )
  })

  it('menolak entitas yang tidak boleh dilampiri', async () => {
    await expect(listAttachments('User', 'u1')).rejects.toMatchObject({
      code: 'ENTITY_NOT_ATTACHABLE',
    })
  })
})

describe('getAttachment', () => {
  it('mengembalikan berkas yang ada', async () => {
    findUnique.mockResolvedValue({ id: 'a1' } as never)
    await expect(getAttachment('a1')).resolves.toEqual({ id: 'a1' })
  })

  it('melempar bila berkas tidak ada', async () => {
    findUnique.mockResolvedValue(null as never)
    await expect(getAttachment('hilang')).rejects.toMatchObject({
      code: 'ATTACHMENT_NOT_FOUND',
    })
  })
})

describe('deleteAttachment', () => {
  it('menghapus catatan lalu berkasnya', async () => {
    findUnique.mockResolvedValue({ id: 'a1', storedPath: '2026/08/a1.pdf' } as never)
    hapus.mockResolvedValue({ id: 'a1' } as never)

    await deleteAttachment('a1')

    expect(hapus).toHaveBeenCalledWith({ where: { id: 'a1' } })
    expect(unlink).toHaveBeenCalledWith('/data/unggahan/2026/08/a1.pdf')
  })

  it('tetap berhasil meski berkasnya sudah lenyap dari disk', async () => {
    findUnique.mockResolvedValue({ id: 'a1', storedPath: '2026/08/a1.pdf' } as never)
    hapus.mockResolvedValue({ id: 'a1' } as never)
    vi.mocked(unlink).mockRejectedValueOnce(new Error('ENOENT'))

    await expect(deleteAttachment('a1')).resolves.toMatchObject({ id: 'a1' })
  })
})
