export type ShariahAccountSeed = {
  code: string
  name: string
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'EXPENSE'
  normalBalance: 'DEBIT' | 'CREDIT'
  parentCode: string
  fallbackParentCodes?: string[]
}

export type ShariahSetupRequiredAccount = {
  code: string
  name: string
  module: 'SYIRKAH' | 'SALES' | 'PURCHASING'
}

export const LEGACY_SHARIAH_EQUITY_CODE = '3100'
export const SYIRKAH_PROFIT_SHARING_EQUITY_CODE = '3130'

export const SHARIAH_COA_SEEDS: ShariahAccountSeed[] = [
  { code: '3110', name: 'Modal Syirkah Mudharabah', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000' },
  { code: '3120', name: 'Modal Syirkah Inan', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000' },
  { code: SYIRKAH_PROFIT_SHARING_EQUITY_CODE, name: 'Bagi Hasil Syirkah', type: 'EQUITY', normalBalance: 'DEBIT', parentCode: '3000' },
  { code: '2600', name: 'Kewajiban Syariah', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000' },
  { code: '2601', name: 'Hutang Qard (Kebajikan)', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2600' },
  { code: '2602', name: 'Hutang Salam', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2600' },
  { code: '2603', name: 'Hutang Istishna', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2600' },
  { code: '1404', name: 'Piutang Salam Vendor', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000' },
  {
    code: '1205',
    name: 'Aset / Piutang Barang Istishna (Pembelian)',
    type: 'ASSET',
    normalBalance: 'DEBIT',
    parentCode: '1200',
    fallbackParentCodes: ['1000'],
  },
  { code: '6100', name: 'Beban Ijarah & Ujrah', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6000' },
  { code: '6110', name: 'Beban Ujrah Gaji', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6100' },
  { code: '6120', name: 'Beban Ujrah Sewa & Lainnya', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6100' },
  { code: '6200', name: 'Beban Zakat & Sosial', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6000' },
  { code: '6210', name: 'Zakat Maal Pemilik', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6200' },
  { code: '6220', name: 'Zakat Tijarah (Perdagangan)', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6200' },
  { code: '6230', name: "Cukai Mu'ahidah", type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6200' },
]

export const SHARIAH_COA_ACTIVATION_CODES = SHARIAH_COA_SEEDS.map((account) => account.code)

export const SHARIAH_COA_DEACTIVATION_CODES = [
  ...SHARIAH_COA_ACTIVATION_CODES,
  LEGACY_SHARIAH_EQUITY_CODE,
]

export const SHARIAH_COA_ENABLEMENT_CODES = SHARIAH_COA_ACTIVATION_CODES

export const SHARIAH_SETUP_REQUIRED_ACCOUNTS: ShariahSetupRequiredAccount[] = [
  { code: '3110', name: 'Modal Syirkah Mudharabah', module: 'SYIRKAH' },
  { code: '3120', name: 'Modal Syirkah Inan', module: 'SYIRKAH' },
  { code: '3130', name: 'Bagi Hasil Syirkah', module: 'SYIRKAH' },
  { code: '2602', name: 'Hutang Salam', module: 'SALES' },
  { code: '2603', name: 'Hutang Istishna', module: 'SALES' },
  { code: '1404', name: 'Piutang Salam Vendor', module: 'PURCHASING' },
  { code: '1205', name: 'Aset / Piutang Barang Istishna (Pembelian)', module: 'PURCHASING' },
]

export type SyirkahDominance = 'MUDHARABAH' | 'INAN' | 'MIXED'

// Mudharabah org tidak butuh 3120 (Inan); Inan org tidak butuh 3110 (Mudharabah).
export function filterSeedsByDominance(seeds: ShariahAccountSeed[], dominance: SyirkahDominance): ShariahAccountSeed[] {
  if (dominance === 'MUDHARABAH') return seeds.filter((s) => s.code !== '3120')
  if (dominance === 'INAN') return seeds.filter((s) => s.code !== '3110')
  return seeds
}

export function filterRequiredByDominance(accounts: ShariahSetupRequiredAccount[], dominance: SyirkahDominance): ShariahSetupRequiredAccount[] {
  if (dominance === 'MUDHARABAH') return accounts.filter((a) => a.code !== '3120')
  if (dominance === 'INAN') return accounts.filter((a) => a.code !== '3110')
  return accounts
}
