/**
 * Menyiapkan hierarki organisasi dan domain portal Coreisec secara idempoten.
 * Default selalu dry-run. Perubahan hanya dilakukan bila flag --apply diberikan.
 */
import { connectPostgresClient } from '../../lib/db/postgres'

const TARGET_ORG_ID = '475a4db7-b5c9-45f7-8282-31f72abb45ad'
const TARGET_ORG_SLUG = 'core-islamic-economics'
const PARENT_ORG_NAME = 'CORe Group'
const PARENT_ORG_SLUG = 'core-group'
const MEMBER_HOSTNAME = 'member.coreisec.id'

type OrganizationRow = {
  id: string
  name: string
  slug: string
  parent_org_id: string | null
  settings: Record<string, unknown>
  is_demo: boolean
}

type BranchRow = {
  id: string
  name: string
  code: string
}

type OwnerRow = {
  user_id: string
}

type WarehouseRow = {
  id: string
  name: string
  code: string
}

type BankAccountRow = {
  id: string
  bank_name: string
  account_number: string
}

type StoreRow = {
  id: string
  name: string
  slug: string
}

function wantsApply() {
  return process.argv.includes('--apply')
}

async function main() {
  const apply = wantsApply()
  const client = await connectPostgresClient()

  try {
    await client.query('BEGIN')

    const targetResult = await client.query<OrganizationRow>(
      `SELECT
         id::text,
         name,
         slug,
         parent_org_id::text,
         COALESCE(settings, '{}'::jsonb) AS settings,
         COALESCE(is_demo, FALSE) AS is_demo
       FROM public.organizations
       WHERE id = $1::uuid AND slug = $2
       FOR UPDATE`,
      [TARGET_ORG_ID, TARGET_ORG_SLUG],
    )
    const target = targetResult.rows[0]
    if (!target) {
      throw new Error(`Organisasi target ${TARGET_ORG_SLUG} tidak ditemukan.`)
    }

    const owners = await client.query<OwnerRow>(
      `SELECT user_id::text
       FROM public.org_members
       WHERE org_id = $1::uuid
         AND role = 'owner'
         AND is_active = TRUE
       ORDER BY joined_at ASC`,
      [target.id],
    )
    if (owners.rows.length === 0) {
      throw new Error('Organisasi target tidak memiliki owner aktif. Penyiapan dihentikan.')
    }

    const branches = await client.query<BranchRow>(
      `SELECT id::text, name, code
       FROM public.branches
       WHERE org_id = $1::uuid
       ORDER BY code`,
      [target.id],
    )
    const mainBranch = branches.rows.find((branch) => branch.code === 'MAIN')
    if (!mainBranch) {
      throw new Error('Cabang berkode MAIN tidak ditemukan. Tidak ada Cabang baru yang dibuat otomatis.')
    }

    const parentResult = await client.query<OrganizationRow>(
      `INSERT INTO public.organizations (
         name,
         slug,
         settings,
         is_active,
         is_demo
       )
       VALUES ($1, $2, $3::jsonb, TRUE, $4)
       ON CONFLICT (slug) DO UPDATE
       SET updated_at = public.organizations.updated_at
       RETURNING
         id::text,
         name,
         slug,
         parent_org_id::text,
         COALESCE(settings, '{}'::jsonb) AS settings,
         COALESCE(is_demo, FALSE) AS is_demo`,
      [
        PARENT_ORG_NAME,
        PARENT_ORG_SLUG,
        JSON.stringify(target.settings),
        target.is_demo,
      ],
    )
    const parent = parentResult.rows[0]

    if (parent.parent_org_id) {
      throw new Error('CORe Group sudah menjadi anak organisasi lain. Hierarki tidak aman untuk diubah.')
    }
    if (parent.id === target.id) {
      throw new Error('Organisasi induk dan anak tidak boleh sama.')
    }

    for (const owner of owners.rows) {
      await client.query(
        `INSERT INTO public.org_members (org_id, user_id, role, is_active)
         VALUES ($1::uuid, $2::uuid, 'owner', TRUE)
         ON CONFLICT (org_id, user_id) DO UPDATE
         SET role = 'owner', is_active = TRUE`,
        [parent.id, owner.user_id],
      )
    }

    await client.query(
      `UPDATE public.organizations
       SET parent_org_id = $1::uuid, updated_at = NOW()
       WHERE id = $2::uuid
         AND parent_org_id IS DISTINCT FROM $1::uuid`,
      [parent.id, target.id],
    )

    await client.query(
      `UPDATE public.branches
       SET name = 'Cabang Utama', updated_at = NOW()
       WHERE id = $1::uuid
         AND code = 'MAIN'
         AND name IS DISTINCT FROM 'Cabang Utama'`,
      [mainBranch.id],
    )

    const warehouseResult = await client.query<WarehouseRow>(
      `INSERT INTO public.warehouses (
         org_id, branch_id, code, name, is_active
       )
       VALUES ($1::uuid, $2::uuid, 'ONLINE', 'Gudang Penjualan Daring', TRUE)
       ON CONFLICT (org_id, code) DO UPDATE SET
         branch_id = EXCLUDED.branch_id,
         name = EXCLUDED.name,
         is_active = TRUE,
         updated_at = NOW()
       RETURNING id::text, name, code`,
      [target.id, mainBranch.id],
    )
    const warehouse = warehouseResult.rows[0]

    const bankResult = await client.query<BankAccountRow>(
      `SELECT id::text, bank_name, account_number
       FROM public.bank_accounts
       WHERE org_id = $1::uuid
         AND branch_id = $2::uuid
         AND is_active = TRUE
       ORDER BY created_at
       LIMIT 1
       FOR UPDATE`,
      [target.id, mainBranch.id],
    )
    const bankAccount = bankResult.rows[0]
    if (!bankAccount) {
      throw new Error(
        'Cabang Utama belum memiliki rekening bank aktif. '
        + 'Store Coreisec tidak dapat dibuat dengan aman.',
      )
    }

    const storeResult = await client.query<StoreRow>(
      `INSERT INTO public.stores (
         org_id, branch_id, warehouse_id, bank_account_id,
         name, slug, brand_name, line_name, support_email,
         headline, subheadline, currency, is_active, is_published, created_by
       )
       VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'Coreisec Learning Store', 'coreisec', 'Coreisec',
         'Pendidikan dan Ekonomi Islam', 'support@coreisec.id',
         'Belajar, bertumbuh, dan kelola akses Anda',
         'Kelas, membership, pesanan, dan sertifikat dalam satu portal.',
         'IDR', TRUE, TRUE, $5::uuid
       )
       ON CONFLICT (org_id, slug) DO UPDATE SET
         branch_id = EXCLUDED.branch_id,
         warehouse_id = EXCLUDED.warehouse_id,
         bank_account_id = EXCLUDED.bank_account_id,
         is_active = TRUE,
         is_published = TRUE,
         updated_at = NOW()
       RETURNING id::text, name, slug`,
      [target.id, mainBranch.id, warehouse.id, bankAccount.id, owners.rows[0].user_id],
    )
    const store = storeResult.rows[0]

    await client.query(
      `INSERT INTO public.store_settings (
         org_id, store_id, seo_title, seo_description,
         allow_guest_checkout, allow_manual_payment
       )
       VALUES (
         $1::uuid, $2::uuid, 'Coreisec Member & Learning Portal',
         'Portal kelas, membership, pesanan, dan sertifikat Coreisec.',
         TRUE, TRUE
       )
       ON CONFLICT (store_id) DO UPDATE SET
         org_id = EXCLUDED.org_id,
         allow_guest_checkout = TRUE,
         allow_manual_payment = TRUE,
         updated_at = NOW()`,
      [target.id, store.id],
    )

    await client.query(
      `INSERT INTO public.organization_domains (
         org_id,
         hostname,
         purpose,
         is_primary,
         status,
         verified_at
       )
       VALUES ($1::uuid, $2, 'MEMBER_PORTAL', TRUE, 'VERIFIED', NOW())
       ON CONFLICT (lower(hostname)) DO UPDATE
       SET
         org_id = EXCLUDED.org_id,
         purpose = EXCLUDED.purpose,
         is_primary = TRUE,
         status = 'VERIFIED',
         verified_at = COALESCE(public.organization_domains.verified_at, NOW()),
         updated_at = NOW()`,
      [target.id, MEMBER_HOSTNAME],
    )

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
         'Sertifikat Utama Coreisec',
         $2::jsonb,
         'CORE/CERT/{YYYY}/{SEQ}',
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
      parent: { id: parent.id, name: PARENT_ORG_NAME, slug: PARENT_ORG_SLUG },
      child: { id: target.id, name: target.name, slug: target.slug },
      ownersCopied: owners.rows.length,
      branch: { id: mainBranch.id, from: mainBranch.name, to: 'Cabang Utama', code: 'MAIN' },
      warehouse: { id: warehouse.id, name: warehouse.name, code: warehouse.code },
      bankAccount: {
        id: bankAccount.id,
        label: `${bankAccount.bank_name} ${bankAccount.account_number}`,
      },
      store: { id: store.id, name: store.name, slug: store.slug },
      domain: MEMBER_HOSTNAME,
      existingBranchesPreserved: branches.rows.length,
      notificationTemplates: 16,
      certificateTemplateEnsured: true,
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
  console.error(`[coreisec:setup] ${message}`)
  process.exitCode = 1
})
