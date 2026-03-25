'use server'

import { createClient } from '@/lib/supabase/server'
import { generateSlug } from '@/lib/utils'
import * as fs from 'fs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Organization } from '@/types/database.types'
import { cookies } from 'next/headers'

const DEMO_EMAIL = 'demo@nizam.app'

// ─────────────────────────────────────────────────────────────
// createOrganization — Called during onboarding
// Creates org + makes current user the owner member
// ─────────────────────────────────────────────────────────────
export async function createOrganization(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const name = (formData.get('name') as string).trim()
  if (!name) return { error: 'Nama organisasi wajib diisi' }

  const slug = generateSlug(name)

  const orgId = crypto.randomUUID()

  // Create the organization
  const { error: orgError } = await supabase
    .from('organizations')
    .insert({
      id: orgId,
      name,
      slug,
      settings: {
        currency: 'IDR',
        timezone: 'Asia/Jakarta',
        fiscal_year_start_month: 1, // January
      },
    })

  if (orgError) {
    const fs = require('fs')
    fs.appendFileSync('/tmp/nizam_debug.log', `Org Error (manual ID ${orgId}): ${JSON.stringify(orgError)}\n`)
    console.error('Organization creation error:', orgError)
    if (orgError.code === '23505') {
      return { error: 'Nama organisasi ini sudah digunakan. Coba nama lain.' }
    }
    return { error: 'Gagal membuat organisasi.' }
  }

  // Make current user the owner
  const { error: memberError } = await supabase
    .from('org_members')
    .insert({
      org_id: orgId,
      user_id: user.id,
      role: 'owner',
    })

  if (memberError) {
    fs.appendFileSync('/tmp/nizam_debug.log', `Member Error (org ${orgId}): ${JSON.stringify(memberError)}\n`)
    return { error: 'Gagal menambahkan anggota.' }
  }

  revalidatePath('/dashboard')
  return redirect('/dashboard')
}

// ─────────────────────────────────────────────────────────────
// getActiveOrg — Get the org the current user is a member of
// (For multi-org support: returns first active org, can extend later)
// ─────────────────────────────────────────────────────────────
export async function getActiveOrg(): Promise<{
  org: Organization
  role: string
} | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // ─────────────────────────────────────────────────────────────
  // DEMO MODE OVERRIDE: 
  // If demo user, prioritize the Org ID from the session cookie
  // ─────────────────────────────────────────────────────────────
  const isDemoUser = user.email === DEMO_EMAIL || user.user_metadata?.is_demo
  const cookieStore = await cookies()
  const demoOrgId = cookieStore.get('nizam_demo_org_id')?.value

  if (isDemoUser && demoOrgId) {
    const { data: demoData, error: demoErr } = await supabase
      .from('org_members')
      .select(`
        role,
        organizations (*)
      `)
      .eq('user_id', user.id)
      .eq('org_id', demoOrgId)
      .eq('is_active', true)
      .maybeSingle()

    if (demoData && !demoErr) {
      return {
        org: demoData.organizations as unknown as Organization,
        role: demoData.role,
      }
    }
  }

  // Regular lookup (or fallback for demo if cookie missing)
  const { data, error } = await supabase
    .from('org_members')
    .select(`
      role,
      organizations (*)
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !data) return null

  return {
    org: data.organizations as unknown as Organization,
    role: data.role,
  }
}

// ─────────────────────────────────────────────────────────────
// updateOrgSettings — Update org name, currency, etc.
// ─────────────────────────────────────────────────────────────
export async function updateOrgSettings(orgId: string, updates: {
  name?: string
  settings?: Record<string, unknown>
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)

  if (error) return { error: 'Gagal menyimpan pengaturan.' }

  revalidatePath('/settings')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// inviteMember — Invite a user by email to the org
// (For now: inserts member by email lookup — Phase 2 adds email invite)
// ─────────────────────────────────────────────────────────────
export async function getOrgMembers(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('org_members')
    .select(`
      *,
      organizations (name)
    `)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })

  if (error) return []
  return data as any[]
}

// ─────────────────────────────────────────────────────────────
// destroyOrganization — The "Nuclear" Option
// Deletes everything (cascade) and forces owner to onboarding
// ─────────────────────────────────────────────────────────────
export async function destroyOrganization(orgId: string) {
  const supabase = await createClient()

  // 1. Security Check (Must be owner)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: member, error: memberError } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (memberError || member?.role !== 'owner') {
    return { error: 'Hanya OWNER yang bisa menghapus total organisasi ini.' }
  }

  // 2. The Big Delete
  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', orgId)

  if (error) return { error: 'Gagal menghapus organisasi: ' + error.message }

  // 3. Clear Cache & Redirect
  revalidatePath('/', 'layout')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// getBranches — Get all branches for an org
// ─────────────────────────────────────────────────────────────
export async function getBranches(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('code', { ascending: true })

  if (error) {
    console.warn('[Supabase] getBranches failed. Pastikan tabel branches sudah ada (jalankan db push/migrate).', error.message || error);
    return []
  }

  return data
}

// ─────────────────────────────────────────────────────────────
// createBranch — Create a new branch/unit
// ─────────────────────────────────────────────────────────────
export async function createBranch(orgId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const code = formData.get('code') as string
  const address = formData.get('address') as string

  const { error } = await supabase
    .from('branches')
    .insert({
      org_id: orgId,
      name,
      code,
      address,
      is_active: true
    })

  if (error) return { error: error.message }

  revalidatePath('/settings/branches')
  return { success: true }
}
