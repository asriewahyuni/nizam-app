/**
 * Ringkasan job order yang aman dipakai lintas modul sebagai seed copy/generator.
 */
export type ServiceOrderSeed = {
  id: string
  jobNumber: string
  description: string
  notes: string
  estimatedCost: number
  status: string
  branchName: string
  startDate: string | null
}
