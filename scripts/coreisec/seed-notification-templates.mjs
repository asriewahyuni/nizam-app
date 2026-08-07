/**
 * Seed template notifikasi WhatsApp (Dripsender) & Email untuk siklus order
 * (pending pembayaran, lunas, akses aktif, refund, komisi afiliasi).
 * Gaya bahasa diadaptasi dari konfigurasi Sejoli/dripsender-sejoli-dis lama,
 * disesuaikan ke variabel {{...}} yang dipakai modules/notifications/outbox.server.ts.
 *
 * Jalankan: node scripts/coreisec/seed-notification-templates.mjs
 */
import 'dotenv/config'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const ORG_IDS = [
  '81b0de5c-2e89-49f9-b2b0-7401d3f9dad3', // CORe ISEC
  '475a4db7-b5c9-45f7-8282-31f72abb45ad', // CORe Islamic Economics
]

const FOOTER_WA = `
_Admin_
*Alisa coreisec.id*
___________________
_*) Dukung Dakwah Ekonomi Islam dengan ikut FOLLOW, SUBSCRIBE dan BERGABUNG ke MU'AMALAH CIRCLE:_
1️⃣ *Saluran WA:* https://whatsapp.com/channel/0029VaSqY6SCHDynbP12IZ3c
2️⃣ *WA Group:* https://chat.whatsapp.com/Co1KW93NrU3AB7byyxRFGz

\`\`\`Expertice Change Everything\`\`\`
*©️CENTER OF RESEARCH ISLAMIC ECONOMICS*`

const TEMPLATES = [
  {
    key: 'ORDER_PENDING_PAYMENT',
    email: {
      subject: '{{name}}, selesaikan pembayaran order {{order_number}}',
      body: `<p>Assalamu'alaikum, kak {{name}}</p><p>Terima kasih sudah order <strong>{{product_name}}</strong>. Selesaikan pembayaran sebesar <strong>{{amount}}</strong> sebelum {{payment_due}} agar pesanan bisa segera kami proses.</p><p>Nomor order: {{order_number}}</p><p><i>Syukran wa Jazakumullahu khairan</i></p>`,
    },
    whatsapp: {
      body: `Assalamu'alaikum, kak {{name}}

Terima kasih sudah order *{{product_name}}*. Selesaikan pembayaran sebesar *{{amount}}* sebelum {{payment_due}} ya kak, agar pesanan #{{order_number}} bisa segera kami proses.

_Syukran wa Jazakumullahu khairan_
${FOOTER_WA}`,
    },
  },
  {
    key: 'ORDER_PAID',
    email: {
      subject: 'Pembayaran order {{order_number}} diterima',
      body: `<p>Bismillah, Alhamdulillah kak {{name}}, pembayaran untuk order <strong>{{order_number}}</strong> sebesar <strong>{{amount}}</strong> telah BERHASIL kami verifikasi.</p><p>Semoga rezeki kak {{name}} oleh Allah SWT dilimpahkan keberkahan, Aamiin.</p>`,
    },
    whatsapp: {
      body: `Bismillah, Alhamdulillah kak *{{name}}*, pembayaran untuk orderan #{{order_number}} sebesar *{{amount}}* telah BERHASIL kami verifikasi. Semoga rezeki kak {{name}} oleh Allah SWT dilimpahkan keberkahan Aamiin...

*Note:* Selanjutnya insyaa Allah akan kami update lagi informasinya via nomor ini.
${FOOTER_WA}`,
    },
  },
  {
    key: 'ORDER_CANCELLED',
    email: {
      subject: 'Order {{order_number}} dibatalkan',
      body: `<p>Assalamu'alaikum, kak {{name}}</p><p>Kami mohon maaf, karena order <strong>{{order_number}}</strong> ({{product_name}}) belum ada konfirmasi pembayaran lanjutan, maka dengan berat hati kami batalkan.</p><p>Jika masih berminat, silakan lakukan pemesanan kembali dari awal ya.</p><p>Terima kasih.</p>`,
    },
    whatsapp: {
      body: `Assalamu'alaikum, kak {{name}}

Kami mohon maaf, karena pesanan #{{order_number}} ({{product_name}}) belum ada konfirmasi lanjutan soal pembayarannya, maka dengan berat hati kami batalkan ya kak.

Jika masih berminat, silakan diproses kembali lagi dari awal ya.

Terima kasih.
Admin coreisec.id`,
    },
  },
  {
    key: 'ENROLLMENT_CREATED',
    email: {
      subject: 'Akses kelas {{course_title}} sudah aktif',
      body: `<p>Alhamdulillah kak {{name}}, akses Anda ke <strong>{{course_title}}</strong> sudah AKTIF dan bisa diakses.</p><p><strong>CARA AKSES KELASNYA:</strong></p><ol><li>Kunjungi {{portal_url}}</li><li>Login dengan email &amp; password akun Anda.</li><li>Pilih Menu Akses Kelas Anda.</li><li>Klik kelas yang diikuti untuk membuka rekaman video / materi.</li></ol><p><i>Syukran wa Jazakumullahu khairan</i></p>`,
    },
    whatsapp: {
      body: `Alhamdulillah, akses kelas untuk program *{{course_title}}* sudah aktif ya kak {{name}}. Semoga manfaat dan berkah.

*CARA AKSES KELASNYA:*
1. Kunjungi {{portal_url}}
2. Login dengan email / password yang sudah dibuat.
3. Pilih Menu Akses Kelas Anda.
4. Klik kelas yang diikuti, akan muncul akses materi/rekaman video.

_Syukran wa Jazakumullahu khairan_
${FOOTER_WA}`,
    },
  },
  {
    key: 'ORDER_REFUNDED',
    email: {
      subject: 'Refund order {{order_number}} telah diproses',
      body: `<p>Assalamu'alaikum, kak {{name}}</p><p>Pesanan Anda dengan nomor <strong>{{order_number}}</strong> sebesar <strong>{{amount}}</strong> telah kami REFUND. Silakan dicek kembali rekening/metode pembayaran Anda.</p><p>Terima kasih.</p>`,
    },
    whatsapp: {
      body: `Assalamu'alaikum, kak {{name}}

Pesanan Anda #{{order_number}} sebesar *{{amount}}* telah kami lakukan refund ya, silakan dicek kembali.

Terima kasih.
___________________
_*) Jika ingin update info & program terbaru, silakan bergabung ke channel telegram official kami t.me/coreisecid_`,
    },
  },
  {
    key: 'ORDER_IN_PROGRESS',
    email: {
      subject: 'Pesanan {{order_number}} sedang diproses',
      body: `<p>Assalamu'alaikum, kak {{name}}</p><p>Pesanan Anda <strong>{{order_number}}</strong> senilai <strong>{{amount}}</strong> sedang kami proses.</p><p>Kami akan kabari lagi begitu ada perkembangan.</p><p><i>Syukran wa Jazakumullahu khairan</i></p>`,
    },
    whatsapp: {
      body: `Assalamu'alaikum, kak {{name}}

Pesanan Anda #{{order_number}} senilai *{{amount}}* sedang kami proses ya kak.

Kami kabari lagi begitu ada perkembangan.

_Syukran wa Jazakumullahu khairan_
${FOOTER_WA}`,
    },
  },
  {
    key: 'ORDER_SHIPPING',
    email: {
      subject: 'Pesanan {{order_number}} sedang dikirim',
      body: `<p>Assalamu'alaikum, kak {{name}}</p><p>Kabar baik! Pesanan Anda <strong>{{order_number}}</strong> senilai <strong>{{amount}}</strong> sedang dalam proses pengiriman.</p><p>Terima kasih sudah bersabar menunggu.</p>`,
    },
    whatsapp: {
      body: `Assalamu'alaikum, kak {{name}}

Kabar baik! Pesanan Anda #{{order_number}} senilai *{{amount}}* sedang dalam proses pengiriman ya kak.

Terima kasih sudah bersabar menunggu.
${FOOTER_WA}`,
    },
  },
  {
    key: 'ORDER_COMPLETED',
    email: {
      subject: 'Pesanan {{order_number}} selesai',
      body: `<p>Alhamdulillah, kak {{name}}</p><p>Pesanan Anda <strong>{{order_number}}</strong> senilai <strong>{{amount}}</strong> telah SELESAI.</p><p>Terima kasih atas kepercayaannya, semoga bermanfaat dan berkah.</p>`,
    },
    whatsapp: {
      body: `Alhamdulillah, kak {{name}}

Pesanan Anda #{{order_number}} senilai *{{amount}}* telah SELESAI.

Terima kasih atas kepercayaannya, semoga bermanfaat dan berkah.
${FOOTER_WA}`,
    },
  },
  {
    key: 'ORDER_ACCESS_RESENT',
    email: {
      subject: '[Akses Kelas] Info order {{order_number}}',
      body: `<p>Assalamu'alaikum, kak {{name}}</p><p>Berikut kami kirimkan ulang info akses kelas untuk pesanan Anda.</p><p>Nomor order: <strong>{{order_number}}</strong><br/>Total pembayaran: <strong>{{amount}}</strong><br/>Status: <strong>LUNAS</strong></p><p><strong>CARA AKSES KELASNYA:</strong></p><ol><li>Kunjungi {{portal_url}}</li><li>Login dengan email &amp; password akun Anda.</li><li>Pilih Menu Akses Kelas Anda.</li></ol><p><i>Syukran wa Jazakumullahu khairan</i></p>`,
    },
    whatsapp: {
      body: `Assalamu'alaikum, kak {{name}}

Berikut kami kirimkan ulang info akses kelas untuk pesanan Anda.

Nomor order: #{{order_number}}
Total pembayaran: *{{amount}}*
Status: *LUNAS*

*CARA AKSES KELASNYA:*
1. Kunjungi {{portal_url}}
2. Login dengan email / password akun Anda.
3. Pilih Menu Akses Kelas Anda.

_Syukran wa Jazakumullahu khairan_
${FOOTER_WA}`,
    },
  },
  {
    key: 'AFFILIATE_COMMISSION_EARNED',
    email: {
      subject: 'Komisi baru dari order {{order_number}}',
      body: `<p>Assalamu'alaikum, Bpk/Ibu {{affiliate_name}}</p><p>Alhamdulillah, Bpk/Ibu baru saja mendapatkan komisi dari order <strong>{{order_number}}</strong> atas nama {{buyer_name}} sebesar <strong>{{commission_amount}}</strong>.</p><p>Cek daftar komisi Anda di {{portal_url}}</p>`,
    },
    whatsapp: {
      body: `Assalamu'alaikum,

Alhamdulillah, Bpk/Ibu *{{affiliate_name}}* baru saja mendapatkan komisi dari order #{{order_number}} atas nama {{buyer_name}} sebesar *{{commission_amount}}*.

Bpk/Ibu bisa cek list komisi di sini ya {{portal_url}}
${FOOTER_WA}`,
    },
  },
  {
    key: 'AFFILIATE_COMMISSION_PAID',
    email: {
      subject: 'Komisi afiliasi Anda telah dicairkan',
      body: `<p>Assalamu'alaikum, Bpk/Ibu {{affiliate_name}}</p><p>Alhamdulillah komisi afiliasi Anda sebesar <strong>{{commission_amount}}</strong> sudah kami cairkan. Silakan cek rekening bank Anda.</p><p>Syukran wa Jazakumullahu khairan.</p>`,
    },
    whatsapp: {
      body: `Assalamu'alaikum,

Alhamdulillah Bpk/Ibu *{{affiliate_name}}*, komisi Bpk/Ibu sebesar *{{commission_amount}}* sudah kami cairkan ya. Silakan cek rekening banknya.

Syukran wa Jazakumullahu khairan,
${FOOTER_WA}`,
    },
  },
]

async function upsertTemplate(orgId, key, channel, subject, body, providerCode) {
  await pool.query(
    `INSERT INTO public.notification_templates (
       org_id, template_key, channel, subject_template, body_template, provider_code, is_active
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, true)
     ON CONFLICT (org_id, template_key, channel) DO UPDATE
     SET subject_template = EXCLUDED.subject_template,
         body_template = EXCLUDED.body_template,
         provider_code = EXCLUDED.provider_code,
         is_active = true,
         updated_at = now()`,
    [orgId, key, channel, subject, body, providerCode],
  )
}

async function main() {
  let count = 0
  for (const orgId of ORG_IDS) {
    for (const tpl of TEMPLATES) {
      await upsertTemplate(orgId, tpl.key, 'EMAIL', tpl.email.subject, tpl.email.body, 'MAILKETING')
      await upsertTemplate(orgId, tpl.key, 'WHATSAPP', null, tpl.whatsapp.body, 'DRIPSENDER')
      count += 2
    }
  }
  console.log(`Seeded/updated ${count} notification_templates rows across ${ORG_IDS.length} org(s).`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
