/**
 * Menyiapkan struktur Cabang program untuk org CORe ISEC (81b0de5c), berdasarkan
 * rekening bank operasional yang sudah dibuat manual oleh pengguna. Idempoten,
 * default dry-run; perubahan hanya dilakukan bila flag --apply diberikan.
 */
import { connectPostgresClient } from '../../lib/db/postgres'

const TARGET_ORG_ID = '81b0de5c-2e89-49f9-b2b0-7401d3f9dad3'
const TARGET_ORG_SLUG = 'core-isec'
const PARENT_ORG_SLUG = 'core-group'

const PROGRAM_BRANCHES = [
  { code: 'ISEC001', name: 'Pakar Ekonomi Islam', bankAccountId: '15fda1ef-2df8-425e-9d17-3a4ac509acb1' },
  { code: 'ISEC002', name: 'Akademi Muslim Sejati (AMS)', bankAccountId: '02ca6414-3f54-47f2-9469-f89b3a40025f' },
  { code: 'ISEC003', name: 'Workshop Syirkah', bankAccountId: '48beeb08-6aa4-4a73-be08-3fd98dec18e6' },
]

type OrganizationRow = { id: string; name: string; slug: string; parent_org_id: string | null }
type BranchRow = { id: string; name: string; code: string }
type OwnerRow = { user_id: string }

function wantsApply() {
  return process.argv.includes('--apply')
}

async function main() {
  const apply = wantsApply()
  const client = await connectPostgresClient()

  try {
    await client.query('BEGIN')

    const targetResult = await client.query<OrganizationRow>(
      `SELECT id::text, name, slug, parent_org_id::text
       FROM public.organizations
       WHERE id = $1::uuid AND slug = $2
       FOR UPDATE`,
      [TARGET_ORG_ID, TARGET_ORG_SLUG],
    )
    const target = targetResult.rows[0]
    if (!target) throw new Error(`Organisasi target ${TARGET_ORG_SLUG} tidak ditemukan.`)

    const parentResult = await client.query<OrganizationRow>(
      `SELECT id::text, name, slug, parent_org_id::text
       FROM public.organizations
       WHERE slug = $1
       FOR UPDATE`,
      [PARENT_ORG_SLUG],
    )
    const parent = parentResult.rows[0]
    if (!parent) throw new Error(`Organisasi induk ${PARENT_ORG_SLUG} tidak ditemukan.`)
    if (parent.id === target.id) throw new Error('Organisasi induk dan anak tidak boleh sama.')

    const owners = await client.query<OwnerRow>(
      `SELECT user_id::text FROM public.org_members
       WHERE org_id = $1::uuid AND role = 'owner' AND is_active = TRUE
       ORDER BY joined_at ASC`,
      [target.id],
    )
    if (owners.rows.length === 0) throw new Error('Organisasi target tidak memiliki owner aktif.')

    const mainResult = await client.query<BranchRow>(
      `SELECT id::text, name, code FROM public.branches
       WHERE org_id = $1::uuid AND code = 'MAIN'
       FOR UPDATE`,
      [target.id],
    )
    const mainBranch = mainResult.rows[0]
    if (!mainBranch) throw new Error('Cabang berkode MAIN tidak ditemukan.')

    await client.query(
      `UPDATE public.organizations
       SET parent_org_id = $1::uuid, updated_at = NOW()
       WHERE id = $2::uuid AND parent_org_id IS DISTINCT FROM $1::uuid`,
      [parent.id, target.id],
    )

    for (const owner of owners.rows) {
      await client.query(
        `INSERT INTO public.org_members (org_id, user_id, role, is_active)
         VALUES ($1::uuid, $2::uuid, 'owner', TRUE)
         ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'owner', is_active = TRUE`,
        [parent.id, owner.user_id],
      )
    }

    await client.query(
      `UPDATE public.branches
       SET name = 'Cabang Utama', updated_at = NOW()
       WHERE id = $1::uuid AND code = 'MAIN' AND name IS DISTINCT FROM 'Cabang Utama'`,
      [mainBranch.id],
    )

    const createdBranches: Array<{ code: string; name: string; id: string; bankAccountAssigned: string }> = []
    for (const program of PROGRAM_BRANCHES) {
      const branchResult = await client.query<BranchRow>(
        `INSERT INTO public.branches (org_id, name, code, is_active)
         VALUES ($1::uuid, $2, $3, TRUE)
         ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE, updated_at = NOW()
         RETURNING id::text, name, code`,
        [target.id, program.name, program.code],
      )
      const branch = branchResult.rows[0]

      const bankUpdate = await client.query(
        `UPDATE public.bank_accounts
         SET branch_id = $1::uuid, updated_at = NOW()
         WHERE id = $2::uuid AND org_id = $3::uuid
         RETURNING id::text, bank_name, account_number`,
        [branch.id, program.bankAccountId, target.id],
      )
      if (bankUpdate.rows.length === 0) {
        throw new Error(`Rekening bank ${program.bankAccountId} untuk Cabang ${program.name} tidak ditemukan.`)
      }

      createdBranches.push({
        code: branch.code,
        name: branch.name,
        id: branch.id,
        bankAccountAssigned: `${bankUpdate.rows[0].bank_name} ${bankUpdate.rows[0].account_number}`,
      })
    }

    await client.query(
      `INSERT INTO public.notification_templates (
         org_id, template_key, channel, subject_template, body_template,
         provider_code, is_active
       )
       SELECT $1::uuid, template_key, channel, subject_template, body_template,
              provider_code, TRUE
       FROM (VALUES
         ('ENROLLMENT_CREATED', 'EMAIL', 'Akses kelas {{course_title}} aktif',
          '<p>Halo {{name}}, akses Anda ke <strong>{{course_title}}</strong> sudah aktif.</p><p>Buka kelas: {{portal_url}}</p>', 'MAILKETING'),
         ('ENROLLMENT_CREATED', 'WHATSAPP', NULL,
          'Halo {{name}}, akses kelas {{course_title}} sudah aktif. Buka: {{portal_url}}', 'FONNTE'),
         ('PAYMENT_CONFIRMED', 'EMAIL', 'Pembayaran {{order_number}} diterima',
          '<p>Pembayaran pesanan {{order_number}} sebesar {{amount}} sudah diterima.</p>', 'MAILKETING'),
         ('PAYMENT_CONFIRMED', 'WHATSAPP', NULL,
          'Pembayaran pesanan {{order_number}} sebesar {{amount}} sudah diterima.', 'FONNTE'),
         ('LESSON_AVAILABLE', 'EMAIL', 'Materi baru sudah terbuka',
          '<p>Materi <strong>{{lesson_title}}</strong> pada {{course_title}} sudah dapat dipelajari.</p>', 'MAILKETING'),
         ('LESSON_AVAILABLE', 'WHATSAPP', NULL,
          'Materi {{lesson_title}} pada {{course_title}} sudah terbuka.', 'FONNTE'),
         ('SESSION_REMINDER', 'EMAIL', 'Pengingat sesi {{session_title}}',
          '<p>Sesi {{session_title}} dimulai {{starts_at}}. Tautan/lokasi: {{location}}</p>', 'MAILKETING'),
         ('SESSION_REMINDER', 'WHATSAPP', NULL,
          'Pengingat: sesi {{session_title}} dimulai {{starts_at}}. {{location}}', 'FONNTE'),
         ('SUBSCRIPTION_REMINDER', 'EMAIL', 'Pengingat perpanjangan langganan',
          '<p>Langganan {{plan_name}} akan diperpanjang pada {{renewal_at}}.</p>', 'MAILKETING'),
         ('SUBSCRIPTION_REMINDER', 'WHATSAPP', NULL,
          'Langganan {{plan_name}} akan diperpanjang pada {{renewal_at}}.', 'FONNTE'),
         ('ASSIGNMENT_DUE', 'EMAIL', 'Tugas {{assignment_title}} mendekati batas waktu',
          '<p>Batas pengumpulan tugas {{assignment_title}} adalah {{due_at}}.</p>', 'MAILKETING'),
         ('ASSIGNMENT_DUE', 'WHATSAPP', NULL,
          'Batas tugas {{assignment_title}} adalah {{due_at}}.', 'FONNTE'),
         ('COURSE_COMPLETED', 'EMAIL', 'Selamat, course telah selesai',
          '<p>Selamat {{name}}, Anda telah menyelesaikan {{course_title}}.</p>', 'MAILKETING'),
         ('COURSE_COMPLETED', 'WHATSAPP', NULL,
          'Selamat {{name}}, Anda telah menyelesaikan {{course_title}}.', 'FONNTE'),
         ('CERTIFICATE_ISSUED', 'EMAIL', 'Sertifikat {{certificate_number}} tersedia',
          '<p>Sertifikat {{certificate_number}} sudah tersedia. Verifikasi: {{verification_url}}</p>', 'MAILKETING'),
         ('CERTIFICATE_ISSUED', 'WHATSAPP', NULL,
          'Sertifikat {{certificate_number}} tersedia. Verifikasi: {{verification_url}}', 'FONNTE')
       ) AS template(template_key, channel, subject_template, body_template, provider_code)
       ON CONFLICT (org_id, template_key, channel) DO UPDATE SET
         subject_template = EXCLUDED.subject_template,
         body_template = EXCLUDED.body_template,
         provider_code = EXCLUDED.provider_code,
         is_active = TRUE,
         updated_at = NOW()`,
      [target.id],
    )

    await client.query(
      `INSERT INTO public.lms_certificate_templates (
         org_id, name, design, numbering_pattern, is_default, is_active
       )
       SELECT
         $1::uuid,
         'Sertifikat Utama CORe ISEC',
         $2::jsonb,
         'ISEC/CERT/{YYYY}/{SEQ}',
         TRUE,
         TRUE
       WHERE NOT EXISTS (
         SELECT 1 FROM public.lms_certificate_templates
         WHERE org_id = $1::uuid AND is_default = TRUE AND is_active = TRUE
       )`,
      [
        target.id,
        JSON.stringify({
          primaryColor: '#047857',
          accentColor: '#F97316',
          heading: 'SERTIFIKAT KELULUSAN',
          statement: 'Diberikan dengan hormat kepada',
          signers: [],
        }),
      ],
    )

    const preview = {
      mode: apply ? 'APPLY' : 'DRY_RUN',
      parent: { id: parent.id, slug: parent.slug },
      child: { id: target.id, name: target.name, slug: target.slug },
      ownersCopiedToParent: owners.rows.length,
      mainBranch: { id: mainBranch.id, from: mainBranch.name, to: 'Cabang Utama', code: 'MAIN' },
      programBranchesCreated: createdBranches,
      notificationTemplates: 16,
      certificateTemplateEnsured: true,
      storeUntouched: '53a49576-95c0-4d32-b33d-7363f28bf1b0 (branch/warehouse/bank left as-is)',
    }

    if (apply) {
      await client.query('COMMIT')
    } else {
      await client.query('ROLLBACK')
    }

    console.log(JSON.stringify(preview, null, 2))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[coreisec:setup-core-isec] ${message}`)
  process.exitCode = 1
})
