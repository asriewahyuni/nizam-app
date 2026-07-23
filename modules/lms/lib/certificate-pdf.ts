/**
 * Renderer PDF sertifikat satu halaman dengan QR verifikasi.
 */
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

export type CertificatePdfInput = {
  organizationName: string
  recipientName: string
  courseTitle: string
  certificateNumber: string
  issueDateLabel: string
  verificationUrl: string
  primaryColor?: string
  accentColor?: string
  heading?: string
  statement?: string
  signers?: Array<{ name: string; title: string }>
}

function color(value: string | undefined, fallback: string) {
  const hex = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback
  return rgb(
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  )
}

function fitText(
  text: string,
  font: { widthOfTextAtSize(value: string, size: number): number },
  maxWidth: number,
  preferredSize: number,
  minimumSize: number,
) {
  let size = preferredSize
  while (size > minimumSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1
  return size
}

function centerX(
  text: string,
  font: { widthOfTextAtSize(value: string, size: number): number },
  size: number,
  pageWidth: number,
) {
  return (pageWidth - font.widthOfTextAtSize(text, size)) / 2
}

export async function renderCertificatePdf(
  input: CertificatePdfInput,
  fonts: { regular: Uint8Array; bold: Uint8Array },
) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const regular = await pdf.embedFont(fonts.regular, { subset: true })
  const bold = await pdf.embedFont(fonts.bold, { subset: true })
  const page = pdf.addPage([841.89, 595.28])
  const { width, height } = page.getSize()
  const primary = color(input.primaryColor, '#047857')
  const accent = color(input.accentColor, '#F97316')
  const dark = rgb(0.06, 0.16, 0.13)
  const muted = rgb(0.34, 0.40, 0.39)

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.97, 0.99, 0.98) })
  page.drawRectangle({
    x: 18,
    y: 18,
    width: width - 36,
    height: height - 36,
    borderColor: primary,
    borderWidth: 5,
  })
  page.drawRectangle({
    x: 29,
    y: 29,
    width: width - 58,
    height: height - 58,
    borderColor: accent,
    borderWidth: 1.5,
  })
  page.drawRectangle({ x: 29, y: height - 47, width: 155, height: 18, color: primary })
  page.drawRectangle({ x: width - 184, y: 29, width: 155, height: 18, color: accent })

  const orgSize = fitText(input.organizationName, bold, width - 180, 17, 12)
  page.drawText(input.organizationName, {
    x: centerX(input.organizationName, bold, orgSize, width),
    y: height - 95,
    size: orgSize,
    font: bold,
    color: primary,
  })
  const heading = input.heading || 'SERTIFIKAT KELULUSAN'
  page.drawText(heading, {
    x: centerX(heading, bold, 28, width),
    y: height - 145,
    size: 28,
    font: bold,
    color: dark,
  })
  const statement = input.statement || 'Diberikan dengan hormat kepada'
  page.drawText(statement, {
    x: centerX(statement, regular, 13, width),
    y: height - 183,
    size: 13,
    font: regular,
    color: muted,
  })
  const nameSize = fitText(input.recipientName, bold, width - 190, 34, 22)
  page.drawText(input.recipientName, {
    x: centerX(input.recipientName, bold, nameSize, width),
    y: height - 235,
    size: nameSize,
    font: bold,
    color: primary,
  })
  page.drawLine({
    start: { x: 150, y: height - 247 },
    end: { x: width - 150, y: height - 247 },
    thickness: 1,
    color: accent,
  })
  const completion = 'telah menyelesaikan program pembelajaran'
  page.drawText(completion, {
    x: centerX(completion, regular, 13, width),
    y: height - 281,
    size: 13,
    font: regular,
    color: muted,
  })
  const courseSize = fitText(input.courseTitle, bold, width - 210, 24, 16)
  page.drawText(input.courseTitle, {
    x: centerX(input.courseTitle, bold, courseSize, width),
    y: height - 325,
    size: courseSize,
    font: bold,
    color: dark,
  })

  const qrDataUrl = await QRCode.toDataURL(input.verificationUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 360,
    color: { dark: '#064E3B', light: '#FFFFFF' },
  })
  const qr = await pdf.embedPng(qrDataUrl)
  page.drawImage(qr, { x: width - 145, y: 72, width: 76, height: 76 })
  page.drawText('Pindai untuk verifikasi', {
    x: width - 154,
    y: 56,
    size: 8.5,
    font: regular,
    color: muted,
  })

  page.drawText(`Nomor: ${input.certificateNumber}`, {
    x: 67,
    y: 91,
    size: 10,
    font: bold,
    color: dark,
  })
  page.drawText(`Terbit: ${input.issueDateLabel}`, {
    x: 67,
    y: 74,
    size: 10,
    font: regular,
    color: muted,
  })
  const signers = (input.signers || []).slice(0, 2)
  signers.forEach((signer, index) => {
    const x = 285 + index * 175
    page.drawLine({
      start: { x, y: 91 },
      end: { x: x + 130, y: 91 },
      thickness: 0.8,
      color: muted,
    })
    const nameSizeSigner = fitText(signer.name, bold, 130, 10, 8)
    page.drawText(signer.name, {
      x: x + (130 - bold.widthOfTextAtSize(signer.name, nameSizeSigner)) / 2,
      y: 74,
      size: nameSizeSigner,
      font: bold,
      color: dark,
    })
    const titleSize = fitText(signer.title, regular, 130, 8.5, 7)
    page.drawText(signer.title, {
      x: x + (130 - regular.widthOfTextAtSize(signer.title, titleSize)) / 2,
      y: 61,
      size: titleSize,
      font: regular,
      color: muted,
    })
  })
  pdf.setTitle(`${input.certificateNumber} - ${input.recipientName}`)
  pdf.setSubject(`Sertifikat ${input.courseTitle}`)
  pdf.setAuthor(input.organizationName)
  pdf.setCreator('Nizam LMS')
  return pdf.save()
}
