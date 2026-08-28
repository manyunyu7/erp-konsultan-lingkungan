import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { requireActor, route } from '@/lib/api'
import { absolutePathFor, getAttachment, isPreviewable, readPermissionFor } from '@/server/attachments'

/**
 * Menyajikan isi berkas.
 *
 * Berkas tidak diletakkan di direktori publik, sehingga setiap pengambilan
 * melewati jalur ini dan diperiksa izinnya lebih dulu.
 */
export const GET = route(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params
    const lampiran = await getAttachment(id)
    await requireActor(readPermissionFor(lampiran.entityType))

    const isi = await readFile(absolutePathFor(lampiran.storedPath))

    return new NextResponse(new Uint8Array(isi), {
      headers: {
        'Content-Type': lampiran.mimeType,
        'Content-Length': String(lampiran.sizeBytes),
        // Gambar dan PDF ditampilkan langsung; sisanya diunduh dengan nama
        // aslinya. Nama dikutip agar tanda baca di dalamnya tidak merusak
        // tajuk permintaan.
        'Content-Disposition': `${isPreviewable(lampiran.mimeType) ? 'inline' : 'attachment'}; filename="${lampiran.originalName.replace(/"/g, '')}"`,
        // Berkas bersifat pribadi; jangan disinggahkan proksi bersama.
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  },
)
