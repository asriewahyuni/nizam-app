import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function resolveExtension(file: File) {
  const extFromName = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() || ''}`.replace(/\.+$/, '')
    : ''
  const extFromType = file.type.includes('/')
    ? `.${file.type.split('/').pop()?.toLowerCase() || ''}`.replace(/\.+$/, '')
    : ''

  return extFromName || extFromType || '.bin'
}

export function sanitizeUploadSegment(value: string) {
  return sanitizeSegment(String(value || '').trim())
}

export async function uploadPublicFile(params: {
  folder: string
  file: File
  fileName: string
}) {
  const safeFolder = params.folder
    .split('/')
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean)
  const safeFileName = sanitizeSegment(params.fileName) || randomUUID()
  const extension = resolveExtension(params.file)
  const relativeDir = path.join('uploads', ...safeFolder)
  const absoluteDir = path.join(process.cwd(), 'public', relativeDir)

  await mkdir(absoluteDir, { recursive: true })

  const finalFileName = `${safeFileName}${extension}`
  const absoluteFilePath = path.join(absoluteDir, finalFileName)
  const relativeUrl = `/${path.posix.join(relativeDir.replace(/\\/g, '/'), finalFileName)}`
  const buffer = Buffer.from(await params.file.arrayBuffer())

  await writeFile(absoluteFilePath, buffer)

  return { url: relativeUrl }
}
