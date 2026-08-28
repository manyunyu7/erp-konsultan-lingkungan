import { describe, expect, it } from 'vitest'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  MAX_SIZE_BYTES,
  assertAttachableEntity,
  assertSizeAllowed,
  assertTypeAllowed,
  buildStoredPath,
  formatSize,
  isPreviewable,
  readPermissionFor,
  sanitizeDisplayName,
  writePermissionFor,
} from './rules'

const NOW = new Date('2026-08-28T10:00:00.000Z')

describe('entitas yang boleh dilampiri', () => {
  it('menerima entitas yang terdaftar', () => {
    expect(() => assertAttachableEntity('Project')).not.toThrow()
    expect(readPermissionFor('Tender')).toBe('tender:read')
    expect(writePermissionFor('Personnel')).toBe('personnel:write')
  })

  it('menolak entitas sembarangan', () => {
    try {
      assertAttachableEntity('User')
      expect.unreachable('seharusnya melempar')
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessRuleError)
      expect((error as BusinessRuleError).code).toBe('ENTITY_NOT_ATTACHABLE')
    }
    expect(() => readPermissionFor('Kucing')).toThrowError(/tidak dapat dilampiri/)
    expect(() => writePermissionFor('Kucing')).toThrowError(/tidak dapat dilampiri/)
  })
})

describe('jenis berkas', () => {
  it('mengenali dokumen dan foto', () => {
    expect(assertTypeAllowed('application/pdf')).toBe('DOKUMEN')
    expect(assertTypeAllowed('image/jpeg')).toBe('FOTO')
    expect(
      assertTypeAllowed(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).toBe('DOKUMEN')
  })

  it('menolak jenis di luar daftar putih', () => {
    // Berkas yang dapat dieksekusi tidak boleh masuk dengan cara apa pun.
    for (const jenis of ['application/x-sh', 'text/html', 'application/javascript']) {
      expect(() => assertTypeAllowed(jenis)).toThrowError(/tidak didukung/)
    }
  })

  it('menandai berkas yang dapat dipratinjau', () => {
    expect(isPreviewable('image/png')).toBe(true)
    expect(isPreviewable('application/pdf')).toBe(true)
    expect(isPreviewable('application/msword')).toBe(false)
    expect(isPreviewable('application/x-sh')).toBe(false)
  })
})

describe('ukuran berkas', () => {
  it('menerima ukuran wajar', () => {
    expect(() => assertSizeAllowed(1024)).not.toThrow()
    expect(() => assertSizeAllowed(MAX_SIZE_BYTES)).not.toThrow()
  })

  it('menolak berkas kosong', () => {
    expect(() => assertSizeAllowed(0)).toThrowError(/kosong/)
    expect(() => assertSizeAllowed(-1)).toThrowError(/kosong/)
  })

  it('menolak berkas melebihi batas', () => {
    expect(() => assertSizeAllowed(MAX_SIZE_BYTES + 1)).toThrowError(/melebihi 10 MB/)
  })
})

describe('sanitizeDisplayName', () => {
  it('membuang pemisah jalur dan titik beruntun', () => {
    expect(sanitizeDisplayName('../../etc/passwd')).toBe('.-.-etc-passwd')
    expect(sanitizeDisplayName('laporan\\akhir.pdf')).toBe('laporan-akhir.pdf')
  })

  it('membuang baris baru yang dapat merusak tampilan', () => {
    expect(sanitizeDisplayName('lap\noran\tfinal.pdf')).toBe('lap oran final.pdf')
  })

  it('memotong nama yang terlalu panjang', () => {
    expect(sanitizeDisplayName('a'.repeat(300))).toHaveLength(150)
  })

  it('memberi nama pengganti bila kosong', () => {
    expect(sanitizeDisplayName('   ')).toBe('berkas')
    expect(sanitizeDisplayName('.')).toBe('berkas')
  })

  it('membiarkan nama wajar apa adanya', () => {
    expect(sanitizeDisplayName('Laporan AMDAL 2026.pdf')).toBe('Laporan AMDAL 2026.pdf')
  })
})

describe('buildStoredPath', () => {
  it('menyusun jalur dari tanggal, pengenal, dan akhiran daftar putih', () => {
    expect(buildStoredPath('application/pdf', 'abc123', NOW)).toBe('2026/08/abc123.pdf')
    expect(buildStoredPath('image/jpeg', 'foto1', NOW)).toBe('2026/08/foto1.jpg')
  })

  it('menolak jenis berkas yang tidak dikenal', () => {
    expect(() => buildStoredPath('text/html', 'x', NOW)).toThrowError(/tidak didukung/)
  })
})

describe('formatSize', () => {
  it('menampilkan ukuran dalam satuan yang mudah dibaca', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2 KB')
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
