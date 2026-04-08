'use server'

import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

type ContactType = 'CUSTOMER' | 'SUPPLIER'
type ContactMutationPayload = {
  name: string
  type: ContactType
  email: string | null
  phone: string | null
  address: string | null
  phone_wa: string | null
  instagram: string | null
}
type ContactMutationResult =
  | { success: true; data: any; error?: undefined }
  | { success?: false; error: string; data?: undefined }
type DeleteContactResult =
  | { success: true; error?: undefined }
  | { success?: false; error: string }

const contactSelect = {
  id: true,
  org_id: true,
  name: true,
  type: true,
  email: true,
  phone: true,
  address: true,
  phone_wa: true,
  instagram: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const

function normalizeOptionalField(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeContact(contact: {
  id: string
  org_id: string
  name: string
  type: string
  email: string | null
  phone: string | null
  address: string | null
  phone_wa: string | null
  instagram: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}) {
  return {
    ...contact,
    created_at: contact.created_at.toISOString(),
    updated_at: contact.updated_at.toISOString(),
  }
}

function parseContactFormData(formData: FormData): ContactMutationPayload | { error: string } {
  const name = typeof formData.get('name') === 'string' ? (formData.get('name') as string).trim() : ''
  const typeValue = typeof formData.get('type') === 'string' ? (formData.get('type') as string).trim() : ''
  const type: ContactType | null = typeValue === 'CUSTOMER' || typeValue === 'SUPPLIER' ? typeValue : null

  if (!name || !type) {
    return { error: 'Nama dan Tipe wajib diisi.' as const }
  }

  return {
    name,
    type,
    email: normalizeOptionalField(formData.get('email')),
    phone: normalizeOptionalField(formData.get('phone')),
    address: normalizeOptionalField(formData.get('address')),
    phone_wa: normalizeOptionalField(formData.get('phone_wa')),
    instagram: normalizeOptionalField(formData.get('instagram')),
  }
}

function revalidateContactPages() {
  revalidatePath('/contacts')
  revalidatePath('/sales')
  revalidatePath('/purchasing')
}

export async function getContacts(orgId: string, type?: 'CUSTOMER' | 'SUPPLIER') {
  const user = await getAuthUser()
  if (!user) return []

  const data = await prisma.contacts.findMany({
    where: {
      org_id: orgId,
      is_active: true,
      ...(type ? { type } : {}),
    },
    select: contactSelect,
    orderBy: {
      name: 'asc',
    },
  })

  return data.map(normalizeContact)
}

export async function createContact(orgId: string, formData: FormData): Promise<ContactMutationResult> {
  const user = await getAuthUser()
  if (!user) return { error: 'Unauthorized' }

  const payload = parseContactFormData(formData)
  if ('error' in payload) return payload

  try {
    const data = await prisma.contacts.create({
      data: {
        org_id: orgId,
        ...payload,
        is_active: true,
      },
      select: contactSelect,
    })

    revalidateContactPages()
    return { success: true, data: normalizeContact(data) }
  } catch (error) {
    return { error: `Gagal membuat kontak: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

export async function updateContact(orgId: string, contactId: string, formData: FormData): Promise<ContactMutationResult> {
  const user = await getAuthUser()
  if (!user) return { error: 'Unauthorized' }

  const payload = parseContactFormData(formData)
  if ('error' in payload) return payload

  const existing = await prisma.contacts.findFirst({
    where: {
      id: contactId,
      org_id: orgId,
      is_active: true,
    },
    select: { id: true },
  })

  if (!existing) return { error: 'Kontak tidak ditemukan.' }

  try {
    const data = await prisma.contacts.update({
      where: { id: contactId },
      data: {
        ...payload,
        updated_at: new Date(),
      },
      select: contactSelect,
    })

    revalidateContactPages()
    return { success: true, data: normalizeContact(data) }
  } catch (error) {
    return { error: `Gagal memperbarui kontak: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

export async function deleteContact(orgId: string, contactId: string): Promise<DeleteContactResult> {
  const user = await getAuthUser()
  if (!user) return { error: 'Unauthorized' }

  const result = await prisma.contacts.updateMany({
    where: {
      id: contactId,
      org_id: orgId,
      is_active: true,
    },
    data: {
      is_active: false,
      updated_at: new Date(),
    },
  })

  if (result.count === 0) return { error: 'Gagal menghapus kontak: data tidak ditemukan.' }

  revalidateContactPages()
  return { success: true }
}
