'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────────────────────
// signIn — Email + Password
// ─────────────────────────────────────────────────────────────
export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string | null

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const params = new URLSearchParams()
    params.set('error', 'Email atau password salah. Silakan coba lagi.')
    if (redirectTo) params.set('redirectTo', redirectTo)
    redirect(`/login?${params.toString()}`)
  }

  redirect(redirectTo || '/dashboard')
}

// ─────────────────────────────────────────────────────────────
// signUp — Register new user
// ─────────────────────────────────────────────────────────────
export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    let msg = 'Gagal mendaftar. Silakan coba lagi.'
    if (error.message.includes('already registered')) {
      msg = 'Email ini sudah terdaftar. Silakan login.'
    }
    const params = new URLSearchParams()
    params.set('error', msg)
    redirect(`/login?${params.toString()}`)
  }

  redirect('/onboarding')
}

// ─────────────────────────────────────────────────────────────
// signOut
// ─────────────────────────────────────────────────────────────
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ─────────────────────────────────────────────────────────────
// getSession — get current user + org context
// ─────────────────────────────────────────────────────────────
export async function getSession() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  return {
    id: user.id,
    email: user.email!,
    fullName: user.user_metadata?.full_name as string | undefined,
    avatarUrl: user.user_metadata?.avatar_url as string | undefined,
  }
}
