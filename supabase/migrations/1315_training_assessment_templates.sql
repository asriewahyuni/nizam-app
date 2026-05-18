-- 1315_training_assessment_templates.sql
-- Custom assessment template builder for LMS courses.
-- Replaces hardcoded templates in training-assessment-mvp.ts

CREATE TABLE IF NOT EXISTS training_assessment_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_slug   TEXT NOT NULL,

  document_title          TEXT NOT NULL DEFAULT '',
  version                 TEXT NOT NULL DEFAULT '1.0',
  effective_date          TEXT NOT NULL DEFAULT '',
  purpose                 TEXT NOT NULL DEFAULT '',
  methods                 TEXT[] NOT NULL DEFAULT '{}',
  competent_when          TEXT[] NOT NULL DEFAULT '{}',
  not_yet_competent_when  TEXT[] NOT NULL DEFAULT '{}',
  theory_questions        TEXT[] NOT NULL DEFAULT '{}',
  answer_guide            TEXT[] NOT NULL DEFAULT '{}',
  practical_tasks         JSONB NOT NULL DEFAULT '[]',
  performance_checklist   TEXT[] NOT NULL DEFAULT '{}',
  evidence_checklist      TEXT[] NOT NULL DEFAULT '{}',
  follow_up_guidance      TEXT[] NOT NULL DEFAULT '{}',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE (org_id, course_slug)
);

-- index for fast lookup by org + course
CREATE INDEX IF NOT EXISTS idx_assessment_templates_org_course
  ON training_assessment_templates (org_id, course_slug);

-- trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION fn_update_assessment_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assessment_template_updated_at ON training_assessment_templates;
CREATE TRIGGER trg_assessment_template_updated_at
  BEFORE UPDATE ON training_assessment_templates
  FOR EACH ROW EXECUTE FUNCTION fn_update_assessment_template_timestamp();

-- ── Seed existing hardcoded templates into DB ──
-- Only insert if not already present (via ON CONFLICT DO NOTHING)

-- Helper: seed for a given org (org_id from the first org that has LMS module)
DO $$
DECLARE
  seed_org_id UUID;
BEGIN
  -- pick the first org that has the LMS module activated
  SELECT mi.org_id INTO seed_org_id
  FROM module_instances mi
  WHERE mi.module_id = 'LMS' AND mi.status = 'READY'
  LIMIT 1;

  IF seed_org_id IS NULL THEN
    -- no LMS org yet, skip seeding
    RETURN;
  END IF;

  -- Course 1: Orientasi Perusahaan Dasar
  INSERT INTO training_assessment_templates (
    org_id, course_slug, document_title, version, effective_date,
    purpose, methods, competent_when, not_yet_competent_when,
    theory_questions, answer_guide, practical_tasks,
    performance_checklist, evidence_checklist, follow_up_guidance
  ) VALUES (
    seed_org_id,
    'orientasi-perusahaan-dasar',
    'Lembar Asesmen Level 0 · Orientasi Perusahaan',
    '1.0',
    '24 April 2026',
    'Menilai kesiapan peserta sebelum masuk ke pelatihan akses dasar NIZAM pada Level 1.',
    ARRAY[
      'Tanya jawab teori singkat tentang jalur akses dan peran pengguna.',
      'Observasi trainer terhadap pemahaman aturan akun dan keamanan dasar.',
      'Verifikasi kesiapan peserta mengikuti urutan belajar berjenjang.'
    ],
    ARRAY[
      'Peserta mampu menjelaskan perbedaan admin bisnis dan panel staf.',
      'Peserta memahami aturan keamanan akun dasar dan tidak berbagi sandi.',
      'Peserta memahami bahwa Level 0 harus selesai sebelum lanjut ke Level 1.'
    ],
    ARRAY[
      'Peserta masih bingung memilih jalur akses sesuai peran.',
      'Peserta belum memahami aturan akun dasar atau masih menormalisasi peminjaman akun.',
      'Peserta belum memahami urutan belajar sehingga berisiko melompati tahap onboarding.'
    ],
    ARRAY[
      'Apa perbedaan fungsi jalur Admin Bisnis dan Panel Staf?',
      'Siapa yang umumnya memakai email bisnis untuk masuk ke NIZAM?',
      'Mengapa satu akun kerja tidak boleh dipakai bergantian oleh beberapa orang?',
      'Apa risiko jika password dibagikan ke rekan kerja?',
      'Kapan peserta harus meminta bantuan trainer atau admin internal?',
      'Mengapa peserta tidak disarankan langsung praktik transaksi tanpa menyelesaikan orientasi?',
      'Setelah Level 0 selesai, course apa yang harus diikuti berikutnya?',
      'Apa tujuan utama halaman Profil Saya dalam konteks identitas kerja?'
    ],
    ARRAY[
      'Admin Bisnis dipakai owner atau admin utama, Panel Staf dipakai karyawan atau operator internal.',
      'Email bisnis dipakai pemilik bisnis atau admin utama yang mengelola akun bisnis.',
      'Agar identitas kerja, audit trail, dan tanggung jawab penggunaan sistem tetap jelas.',
      'Akun bisa diakses pihak yang tidak berwenang dan jejak kerja menjadi tidak valid.',
      'Saat jalur login tidak jelas, akun bermasalah, atau peserta tidak yakin langkah yang benar.',
      'Karena fondasi akses dan keamanan belum kuat sehingga peserta rawan salah jalur dan salah prosedur.',
      'Level 1 Pengguna Umum NIZAM.',
      'Untuk mengelola identitas dasar akun seperti profil, kontak, dan pengaturan pribadi tertentu.'
    ],
    '[
      {"title":"Menentukan Jalur Akses","instruction":"Peserta diminta menjelaskan jalur login yang tepat untuk owner/admin utama dan jalur login yang tepat untuk staf.","expectedEvidence":"Peserta dapat menyebutkan dua jalur akses dan siapa penggunanya tanpa dibimbing."},
      {"title":"Menjelaskan Aturan Akun","instruction":"Peserta diminta menjelaskan minimal tiga aturan dasar keamanan akun yang wajib diikuti.","expectedEvidence":"Peserta menyebutkan sandi tidak dibagikan, akun sesuai identitas kerja, dan eskalasi jika akses bermasalah."},
      {"title":"Menjelaskan Urutan Belajar","instruction":"Peserta diminta menjelaskan urutan belajar dari orientasi sampai masuk ke pelatihan akses dasar.","expectedEvidence":"Peserta dapat menyebutkan Level 0 lebih dulu lalu Level 1 sebelum praktik lanjutan."}
    ]'::JSONB,
    ARRAY[
      'Mampu membedakan jalur admin bisnis dan panel staf.',
      'Mampu menjelaskan siapa yang memakai email bisnis dan siapa yang memakai identitas staf.',
      'Mampu menjelaskan bahwa sandi tidak boleh dibagikan.',
      'Mampu menjelaskan bahwa satu akun mewakili satu identitas kerja.',
      'Mampu menyebutkan pihak yang dihubungi saat akses bermasalah.',
      'Mampu menjelaskan urutan Level 0 lalu Level 1.',
      'Mampu menunjukkan kesiapan mengikuti onboarding tanpa melompati tahap dasar.'
    ],
    ARRAY[
      'Catatan observasi trainer.',
      'Jawaban teori singkat peserta.',
      'Checklist verifikasi kesiapan lanjut ke Level 1.'
    ],
    ARRAY[
      'Jika belum kompeten, ulangi lesson orientasi yang belum dipahami lalu lakukan tanya jawab ulang.',
      'Jika peserta masih bingung soal akses, trainer wajib menegaskan peran peserta sebelum lanjut ke Level 1.',
      'Jika kompeten, peserta dapat dipindahkan ke course Level 1 Pengguna Umum NIZAM.'
    ]
  )
  ON CONFLICT (org_id, course_slug) DO NOTHING;

  -- Course 2: Pengguna Umum NIZAM
  INSERT INTO training_assessment_templates (
    org_id, course_slug, document_title, version, effective_date,
    purpose, methods, competent_when, not_yet_competent_when,
    theory_questions, answer_guide, practical_tasks,
    performance_checklist, evidence_checklist, follow_up_guidance
  ) VALUES (
    seed_org_id,
    'pengguna-umum-nizam',
    'Lembar Asesmen Level 1 · Pengguna Umum NIZAM',
    '1.1',
    '24 April 2026',
    'Menilai kemampuan peserta menjalankan akses awal NIZAM secara mandiri, aman, dan sesuai peran.',
    ARRAY[
      'Tes teori singkat tentang jalur akses, reset password, dan profil dasar.',
      'Uji praktik langsung pada alur daftar akun, login, keamanan akun, dan profil.',
      'Observasi trainer atau assessor terhadap ketelitian, pemahaman, dan kemandirian peserta.'
    ],
    ARRAY[
      'Peserta mampu memilih jalur login yang benar sesuai peran.',
      'Peserta mampu menjelaskan dan mempraktikkan reset password akun bisnis.',
      'Peserta mampu menunjukkan lokasi ganti password mandiri dan pengelolaan profil dasar.',
      'Peserta dapat menjelaskan perbedaan reset password, ganti password, dan lupa password.'
    ],
    ARRAY[
      'Peserta masih bingung memilih jalur login yang benar.',
      'Peserta tidak mampu melakukan reset password tanpa bantuan penuh.',
      'Peserta tidak dapat menemukan menu ganti password dan profil dasar.',
      'Peserta tidak memahami perbedaan reset, ganti, dan lupa password.'
    ],
    ARRAY[
      'Sebutkan dua jalur login NIZAM dan siapa penggunanya.',
      'Bagaimana cara melakukan reset password akun bisnis?',
      'Di mana letak menu ganti password mandiri?',
      'Apa perbedaan reset password dan ganti password?',
      'Apa yang harus dilakukan jika pengguna lupa password?',
      'Informasi apa saja yang bisa dikelola di halaman Profil Saya?',
      'Mengapa penting mengisi data profil dengan benar?'
    ],
    ARRAY[
      'Jalur Admin Bisnis untuk owner/admin, Panel Staf untuk karyawan/operator.',
      'Masuk sebagai Admin Bisnis → Pengaturan Akun → pilih pengguna → klik Reset Password.',
      'Klik foto profil di pojok kanan atas → Profil Saya → tab Keamanan.',
      'Reset: dilakukan admin untuk mengatur ulang password pengguna. Ganti: pengguna mengganti password sendiri. Lupa: pengguna meminta reset melalui email.',
      'Gunakan fitur Lupa Password di halaman login atau minta admin melakukan reset.',
      'Nama lengkap, email, nomor telepon, foto profil, dan informasi kontak lainnya.',
      'Agar identitas kerja valid, memudahkan komunikasi, dan menjaga akuntabilitas.'
    ],
    '[
      {"title":"Login via Jalur yang Benar","instruction":"Peserta diminta login ke NIZAM menggunakan jalur yang sesuai perannya.","expectedEvidence":"Peserta berhasil login tanpa bantuan dan berada di halaman yang sesuai perannya."},
      {"title":"Reset Password Pengguna","instruction":"Peserta diminta melakukan simulasi reset password untuk pengguna lain.","expectedEvidence":"Peserta dapat menunjukkan langkah-langkah reset password dari menu Admin Bisnis."},
      {"title":"Ganti Password Sendiri","instruction":"Peserta diminta mengganti password akun sendiri melalui Profil Saya.","expectedEvidence":"Peserta berhasil membuka menu ganti password dan memahami formulirnya."},
      {"title":"Kelola Profil Dasar","instruction":"Peserta diminta mengisi dan memperbarui data profil dasar.","expectedEvidence":"Peserta berhasil membuka Profil Saya dan menunjukkan field-field yang bisa diisi."}
    ]'::JSONB,
    ARRAY[
      'Mampu memilih jalur login yang benar.',
      'Mampu melakukan reset password untuk pengguna lain.',
      'Mampu menemukan menu ganti password mandiri.',
      'Mampu menjelaskan perbedaan reset, ganti, dan lupa password.',
      'Mampu mengakses dan mengisi Profil Saya.',
      'Mampu menjelaskan pentingnya data profil yang akurat.'
    ],
    ARRAY[
      'Screenshot halaman setelah login berhasil.',
      'Screenshot langkah reset password.',
      'Screenshot halaman Profil Saya.',
      'Catatan observasi trainer.'
    ],
    ARRAY[
      'Jika belum kompeten pada jalur login, ulangi praktik login dengan pendampingan trainer.',
      'Jika belum kompeten pada reset password, lakukan simulasi ulang dengan skenario berbeda.',
      'Jika belum kompeten pada profil, berikan panduan langkah demi langkah pengisian profil.',
      'Jika kompeten, peserta dapat lanjut ke course Level 2 atau modul operasional sesuai perannya.'
    ]
  )
  ON CONFLICT (org_id, course_slug) DO NOTHING;

END $$;
