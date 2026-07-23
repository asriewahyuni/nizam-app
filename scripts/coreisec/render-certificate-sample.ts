/**
 * Membuat artefak contoh untuk QA visual renderer sertifikat.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { renderCertificatePdf } from '../../modules/lms/lib/certificate-pdf'

const require = createRequire(import.meta.url)

async function main() {
  const outputDirectory = resolve('output/pdf')
  await mkdir(outputDirectory, { recursive: true })
  const [regular, bold] = await Promise.all([
    readFile(require.resolve(
      'dejavu-fonts-ttf/ttf/DejaVuSans.ttf',
    )),
    readFile(require.resolve(
      'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',
    )),
  ])
  const pdf = await renderCertificatePdf({
    organizationName: 'CORe Islamic Economics',
    recipientName: 'Ahmad Fikri Ramadhan',
    courseTitle: 'Program Pakar Ekonomi dan Keuangan Syariah',
    certificateNumber: 'CERT/2026/000001',
    issueDateLabel: '23 Juli 2026',
    verificationUrl: 'https://member.coreisec.id/sertifikat/verifikasi/contoh',
    signers: [
      { name: 'Dr. Muhammad Syafii', title: 'Direktur Program' },
      { name: 'Nur Aisyah, M.E.', title: 'Ketua Akademik' },
    ],
  }, { regular, bold })
  const target = resolve(outputDirectory, 'contoh-sertifikat-coreisec.pdf')
  await writeFile(target, pdf)
  console.log(target)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
