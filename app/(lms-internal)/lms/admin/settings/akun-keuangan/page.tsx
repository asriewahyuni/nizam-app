import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getCommerceAccountSettingsData } from '@/modules/ecommerce/lib/commerce-account-settings.server'
import LmsAccountMappingForm from './LmsAccountMappingForm'
import { saveCommerceAccountMappingAction } from './actions'

export const metadata = {
  title: 'Pemetaan Akun Commerce — Nizam LMS Admin',
}

export default async function LmsAccountMappingPage() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return redirect('/onboarding')

  const role = String(orgData.role || '').toLowerCase()
  if (!['owner', 'admin', 'manager'].includes(role)) {
    return redirect('/lms/admin/settings')
  }

  const data = await getCommerceAccountSettingsData(orgData.org.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          /lms/admin/settings · Pemetaan Akun
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pemetaan Akun Commerce</h1>
        <p className="mt-1 text-slate-500">
          Tentukan rekening penerimaan dan akun COA (kas, pendapatan, pajak, diskon, komisi
          afiliasi) per Cabang. Selama pemetaan sebuah Cabang belum lengkap, order yang
          ditandai lunas (manual maupun otomatis) di Cabang tersebut akan gagal disimpan
          dan tidak masuk ke jurnal / laporan keuangan.
        </p>
      </div>

      <LmsAccountMappingForm
        orgId={orgData.org.id}
        branches={data.branches}
        accounts={data.accounts}
        bankAccounts={data.bankAccounts}
        onSaveAction={saveCommerceAccountMappingAction}
      />
    </div>
  )
}
