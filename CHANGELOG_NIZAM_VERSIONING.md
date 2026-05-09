# CHANGELOG - NIZAM Full Versioning

Dokumentasi lengkap perubahan versi NIZAM Full mengikuti standar `vC.M.A.P` (Core.Module.AddOn.Patch).

---

## NIZAM Full v1.2.0.0

**Tanggal Rilis**: 9 Mei 2026  
**Kategori**: MODULE Release  
**Standar**: Core generation 1 | Module iterasi 2 | Add-on belum expand | Patch awal

### Ringkasan
Gelombang ekspansi kedua NIZAM Full dengan fokus pada LMS (Learning Management System) dan peningkatan capabilities di HRIS, Accounting, dan Service Operations.

### Major Changes

#### 📚 **LMS / Academy Module (NEW)** ⭐
- Modul Learning Management System untuk pelatihan komersial
- Backend: `modules/edu/`, `modules/hris/competency-training.server.ts`
- Frontend: `app/(dashboard)/lms/`
- Database migrations: `1247_lms_core_schema.sql` through `1253_inject_lms_coa.sql`
- Features:
  - Course management dan lesson delivery
  - Batch registration dan session attendance
  - Assessment center untuk evaluasi kompetensi
  - Training progress tracking
  - Competency mapping dan training execution

#### 🔧 **Bengkel Motor / Workshop Operations (Service Operations Vertical)**
- Operational module untuk manajemen bengkel motor
- Automatic journal posting untuk SPK (Surat Perintah Kerja)
- Child CoA management untuk tracking per-job
- Feature: Integrasi dengan accounting untuk auto-posting

#### 🏢 **HRIS Competency Training Enhancement**
- Peningkatan signifikan di module HRIS Core
- Competency training execution dan tracking
- Training history dan certification registry
- Database: `1245_hris_competency_trainings.sql`, `1246_hris_competency_training_execution.sql`

#### 📊 **Accounting Enhancement**
- **Child CoA & Consolidation Mapping**
  - Support untuk multi-entity CoA dengan consolidation
  - Database: `1244_child_local_coa_and_consolidation_mapping.sql`
  - Mendukung reporting lintas entitas
  
- **Enhanced Chart of Accounts**
  - Nested hierarchy support
  - Consolidation mapping untuk parent-child orgs

#### 🛒 **Marketplace Module**
- Module activation/deactivation management
- Pricing configuration per module
- Database: `1254_marketplace_deactivate_and_module_pricing.sql`
- Features:
  - Module availability toggle
  - Pricing strategy management
  - Module instance tracking

#### ⚙️ **SaaS Settings**
- Operator-level configuration
- Pricing management untuk SaaS packages
- Database: `1255_saas_catalog_pricing.sql`
- Module: `modules/saas/actions/saas-settings.actions.ts`

#### 📈 **Syirkah Enhancement**
- Profit sharing core posting
- Enhanced syirkah partnership management
- Database: `1243_syirkah_profit_sharing_core_posting.sql`

### Included Modules (Baseline)
- ✓ Job Management (v1.0)
- ✓ Fleet & Rental (v1.1)
- ✓ **LMS / Academy (v1.2) - NEW**
- ✓ HRIS Core (with Competency Training)
- ✓ Accounting (Finance Core with Child CoA)
- ✓ Cash Management
- ✓ Syirkah (with Profit Sharing)
- ✓ Service Operations (Workshop)

### Database Migrations
Total: 10 new migrations

```
1243_syirkah_profit_sharing_core_posting.sql
1244_child_local_coa_and_consolidation_mapping.sql
1245_hris_competency_trainings.sql
1246_hris_competency_training_execution.sql
1247_lms_core_schema.sql
1248_lms_commercial_schema.sql
1249_lms_session_attendances.sql
1250_lms_batch_cost_structure.sql
1251_lms_batch_tax.sql
1252_org_module_instances.sql
1253_inject_lms_coa.sql
1254_marketplace_deactivate_and_module_pricing.sql
1255_saas_catalog_pricing.sql
```

### Training & Sertifikasi Impacts
- **New Track**: LMS Administration (untuk pengelola pelatihan)
- **New Track**: Competency Training Specialist (untuk HRIS)
- **Updated Track**: Workshop Operations (untuk Service Operations)
- Academy module memerlukan kurikulum baru dan assessment
- Competency training terintegrasi dengan HRIS training track

### Compatibility & Migration
- **Backwards Compatible**: Semua fitur sebelumnya tetap berjalan
- **New UI Routes**:
  - `/lms` - LMS Dashboard & Course Management
  - `/lms/my-progress` - Personal progress tracking
  - `/lms/trainings/[id]` - Training detail & attendance
  - `/lms/assessment-center` - Penilaian kompetensi
  - `/lms/admin` - Admin batch & session management
  - `/workshop` - Workshop operations dashboard
  - `/marketplace` - Module marketplace
  - `/saas/pengaturan` - SaaS operator settings
  - `/settings/version-info` - Version information

### Performance Notes
- LMS database schema optimized untuk high-volume course attendance
- Competency training uses indexed queries untuk performance
- Marketplace module checks cached untuk module availability

### Known Limitations
- LMS assessments belum support multimedia (video) dalam lessons
- Competency training badges belum auto-generated
- Marketplace pricing tidak yet support dynamic pricing

---

## NIZAM Full v1.1.0.0

**Tanggal Rilis**: April 2026  
**Kategori**: MODULE Release  
**Standar**: Core generation 1 | Module iterasi 1 | Add-on baseline | Patch awal

### Ringkasan
Perluasan pertama module NIZAM Full dengan penambahan Fleet & Rental capabilities.

### Major Changes
- Fleet & Rental module sebagai operational vertical
- Smart vehicle management
- Rental agreement & contract management
- Vehicle tracking & maintenance scheduling

### Included Modules
- Job Management
- Fleet & Rental (NEW)

---

## NIZAM Full v1.0.0.0

**Tanggal Rilis**: Maret 2026  
**Kategori**: Core Release  
**Standar**: Core generation 1 | Module baseline | Add-on baseline | Patch awal

### Ringkasan
Baseline pertama NIZAM Full dengan core infrastructure dan foundational modules.

### Major Changes
- Core infrastructure (auth, org, tenant, billing)
- Job Management module
- Dashboard shell & navigation foundation
- Internal auth system migration dari Supabase Auth
- Railway PostgreSQL integration

### Included Modules
- Job Management (Jasa Services)

---

## Versioning Guidelines

### Kapan C (Core) Naik?
- Perubahan fundamental pada authentication mechanism
- Tenancy model changes yang affect semua modules
- Platform architecture generation change
- Mandatory migration yang impact semua users

**Reset behavior**: Module, Add-on, Patch semua reset ke 0

### Kapan M (Module) Naik?
- Gelombang perubahan besar di satu atau lebih module families
- New baseline module ditambah official
- Major capability enhancement di module utama
- Changes yang impact training & sertifikasi

**Reset behavior**: Add-on dan Patch reset ke 0

### Kapan A (Add-on) Naik?
- New official add-on diluncurkan
- Major enhancement di existing add-on
- Perubahan signifikan di integration surface

**Reset behavior**: Patch reset ke 0

### Kapan P (Patch) Naik?
- Bug fixes
- Minor adjustments
- Compatibility improvements
- Hotfixes

**Reset behavior**: Tidak ada reset

---

## Version Information Display

Versi NIZAM saat ini ditampilkan di:
1. **Dashboard footer** - Floating badge menunjukkan versi saat ini
2. **Settings → Informasi Versi** - Detailed version information page
3. **Package.json** - SemVer equivalent (`1.2.0`)
4. **lib/version.ts** - Version constants & helpers
5. **HTTP Headers** - X-NIZAM-Version header (jika diimplementasi)

---

## Related Documents
- [STANDAR_RESMI_VERSIONING_NIZAM_FULL.md](./STANDAR_RESMI_VERSIONING_NIZAM_FULL.md) - Detailed versioning specification
- [AGENTS.md](./AGENTS.md) - Architecture overview & technology stack
- [supabase/migrations/](./supabase/migrations/) - Database migration history
