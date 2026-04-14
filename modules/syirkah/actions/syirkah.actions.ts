'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getProfitLoss } from '@/modules/accounting/actions/reports.actions'

// ─── Types ─────────────────────────────────────────────────────────────────

export type SyirkahMemberPayload = {
  id?: string
  member_name: string
  role: 'PEMODAL' | 'PENGELOLA' | 'PEMODAL_PENGELOLA'
  nik?: string
  address?: string
  phone?: string
  email?: string
  responsibility?: string
  profit_share_percentage?: number
  capital_contribution?: number
}

export type SyirkahWitnessPayload = {
  id?: string
  witness_name: string
  gender: 'LAKI-LAKI' | 'PEREMPUAN'
  nik?: string
  address?: string
  phone?: string
}

// Import types locally (for use within this file only)
import type { SyirkahClause } from '@/modules/syirkah/lib/syirkah.utils'

// ─── FETCH ──────────────────────────────────────────────────────────────────

export async function getSyirkahContracts(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_contracts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch syirkah contracts:', error)
    return []
  }

  return data
}

export async function getSyirkahContractById(id: string, orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_contracts')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (error) {
    console.error('Failed to fetch syirkah contract by id:', error)
    return null
  }

  return data
}

export async function getSyirkahContractByToken(token: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_contracts')
    .select(`
      *,
      organizations(name),
      syirkah_members(*)
    `)
    .eq('qr_token', token)
    .single()

  if (error) {
    console.error('Failed to fetch syirkah contract by token:', error)
    return null
  }

  return data
}

export async function getSyirkahMembers(contractId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_members')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch syirkah members:', error)
    return []
  }

  return data
}

// ─── UPSERT ─────────────────────────────────────────────────────────────────

export async function upsertSyirkahContract(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_contracts')
    .upsert({
      ...(payload.id ? { id: payload.id } : {}),
      org_id: orgId,
      title: payload.title,
      description: payload.description,
      contract_type: payload.contract_type || 'Syirkah Mudharabah',
      business_name: payload.business_name,
      business_description: payload.business_description,
      business_document_url: payload.business_document_url,
      duration_months: payload.duration_months || 12,
      debt_allocation: payload.debt_allocation || 0,
      current_debt: payload.current_debt || 0,
      status: payload.status || 'DRAFT',
      start_date: payload.start_date,
      end_date: payload.end_date,
      clauses: payload.clauses,
      signed_by: payload.signed_by,
      signed_at: payload.signed_at,
      wizard_step: payload.wizard_step,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    throw new Error('Gagal menyimpan akad syirkah: ' + error.message)
  }

  revalidatePath('/syirkah')
  return data
}

export async function upsertSyirkahMember(contractId: string, payload: SyirkahMemberPayload) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_members')
    .upsert({
      ...(payload.id ? { id: payload.id } : {}),
      contract_id: contractId,
      member_name: payload.member_name,
      role: payload.role,
      nik: payload.nik,
      address: payload.address,
      phone: payload.phone,
      email: payload.email,
      responsibility: payload.responsibility,
      profit_share_percentage: payload.profit_share_percentage || 0,
      capital_contribution: payload.capital_contribution || 0,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    throw new Error('Gagal menyimpan pihak bersyirkah: ' + error.message)
  }

  revalidatePath(`/syirkah/${contractId}`)
  return data
}

export async function deleteSyirkahMember(id: string, contractId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('syirkah_members')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error('Gagal menghapus pihak bersyirkah: ' + error.message)
  }

  revalidatePath(`/syirkah/${contractId}`)
  return true
}

// ─── WITNESSES ───────────────────────────────────────────────────────────────

export async function getSyirkahWitnesses(contractId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_witnesses')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch syirkah witnesses:', error)
    return []
  }
  return data
}

export async function upsertSyirkahWitness(contractId: string, payload: SyirkahWitnessPayload) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_witnesses')
    .upsert({
      ...(payload.id ? { id: payload.id } : {}),
      contract_id: contractId,
      witness_name: payload.witness_name,
      gender: payload.gender,
      nik: payload.nik,
      address: payload.address,
      phone: payload.phone,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    throw new Error('Gagal menyimpan saksi: ' + error.message)
  }

  revalidatePath(`/syirkah/${contractId}`)
  return data
}

export async function deleteSyirkahWitness(id: string, contractId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('syirkah_witnesses')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error('Gagal menghapus saksi: ' + error.message)
  }

  revalidatePath(`/syirkah/${contractId}`)
  return true
}

/**
 * Dipanggil dari halaman publik /syirkah-sign/[token] untuk saksi
 */
export async function signSyirkahWitness(witnessToken: string) {
  const supabase = await createClient()

  const { data: witness, error: wErr } = await supabase
    .from('syirkah_witnesses')
    .select('*, contract_id')
    .eq('sign_token', witnessToken)
    .single()

  if (wErr || !witness) {
    return { error: 'Token saksi tidak valid.' }
  }

  if (witness.signed_at) {
    return { error: 'Anda sudah menyaksikan akad ini sebelumnya.' }
  }

  const { error: updateErr } = await supabase
    .from('syirkah_witnesses')
    .update({ signed_at: new Date().toISOString() })
    .eq('id', witness.id)

  if (updateErr) {
    return { error: 'Gagal menyimpan kesaksian: ' + updateErr.message }
  }

  revalidatePath(`/syirkah/${witness.contract_id}`)
  return { success: true, witness }
}

export async function getSyirkahWitnessBySignToken(token: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_witnesses')
    .select(`*, syirkah_contracts(*, organizations(name))`)
    .eq('sign_token', token)
    .single()

  if (error) return null
  return data
}

// ─── SIGN CONTRACT ───────────────────────────────────────────────────────────

/**
 * Dipanggil dari halaman publik /syirkah-sign/[memberToken]
 * Mencatat tanda tangan digital anggota berdasarkan sign_token unik.
 */
export async function signSyirkahMember(memberToken: string) {
  const supabase = await createClient()

  // Cari member berdasarkan sign_token
  const { data: member, error: memberErr } = await supabase
    .from('syirkah_members')
    .select('*, contract_id')
    .eq('sign_token', memberToken)
    .single()

  if (memberErr || !member) {
    return { error: 'Token tanda tangan tidak valid atau sudah kedaluwarsa.' }
  }

  if (member.signed_at) {
    return { error: 'Anda sudah menandatangani akad ini sebelumnya.' }
  }

  // Catat tanda tangan
  const { error: updateErr } = await supabase
    .from('syirkah_members')
    .update({ signed_at: new Date().toISOString() })
    .eq('id', member.id)

  if (updateErr) {
    return { error: 'Gagal menyimpan tanda tangan: ' + updateErr.message }
  }

  // Cek apakah semua anggota sudah TTD
  const { data: allMembers } = await supabase
    .from('syirkah_members')
    .select('signed_at')
    .eq('contract_id', member.contract_id)

  const allSigned = allMembers?.every((m: any) => m.signed_at != null)
  if (allSigned) {
    await supabase
      .from('syirkah_contracts')
      .update({
        signed_at: new Date().toISOString(),
        status: 'ACTIVE'
      })
      .eq('id', member.contract_id)
  }

  revalidatePath(`/syirkah/${member.contract_id}`)
  return { success: true, member, allSigned }
}

/**
 * Ambil data member berdasarkan sign_token untuk halaman publik sign.
 */
export async function getSyirkahMemberBySignToken(token: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_members')
    .select(`
      *,
      syirkah_contracts(*, organizations(name))
    `)
    .eq('sign_token', token)
    .single()

  if (error) return null
  return data
}


// ─── DASHBOARD ──────────────────────────────────────────────────────────────

export async function getSyirkahDashboardData(orgId: string) {
  try {
    const pnl = await getProfitLoss(orgId)
    const netProfit = pnl.netProfit || 0

    const contracts = await getSyirkahContracts(orgId)
    const membersByContract = await Promise.all(
      contracts.map((c: any) => getSyirkahMembers(c.id))
    )

    const totalDebtAllocation = contracts.reduce((acc: number, c: any) => acc + Number(c.debt_allocation || 0), 0)
    const totalCurrentDebt = contracts.reduce((acc: number, c: any) => acc + Number(c.current_debt || 0), 0)

    const allMembers = contracts.map((c: any, i: number) => {
      const parts = membersByContract[i]
      return {
        contractId: c.id,
        contractTitle: c.title,
        members: parts.map((p: any) => ({
          ...p,
          estimatedProfitAmount: (netProfit * Number(p.profit_share_percentage || 0)) / 100
        }))
      }
    })

    return {
      netProfit,
      totalDebtAllocation,
      totalCurrentDebt,
      contracts,
      allMembers
    }
  } catch (error) {
    console.error('Failed to get syirkah dashboard data', error)
    return {
      netProfit: 0,
      totalDebtAllocation: 0,
      totalCurrentDebt: 0,
      contracts: [],
      allMembers: []
    }
  }
}
