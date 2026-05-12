'use server'

import { revalidatePath } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { createClient } from '@/lib/supabase/server'
import { TRAINING_COURSES } from '@/modules/edu/lib/training-center-mvp'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (error.message) return String(error.message)
  if (error.details) return String(error.details)
  return 'Unknown error'
}

async function assertOrgAdmin() {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')
  if (!['owner', 'admin'].includes(orgData.role)) throw new Error('Akses ditolak')
  return orgData
}

// ── Courses (Program) ─────────────────────────────────────────────────────────

export async function getLmsCourses(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learning_courses')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getLmsCourses]', error)
    return []
  }
  return data
}

export async function getLmsCourseBySlug(orgId: string, slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learning_courses')
    .select('*')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .single()

  if (error) return null
  return data
}

export async function createLmsCourse(formData: FormData) {
  const orgData = await assertOrgAdmin()

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const levelCode = formData.get('levelCode') as string

  if (!title) throw new Error('Judul course wajib diisi')

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now()

  const supabase = await createClient()
  const { error } = await supabase.from('learning_courses').insert({
    org_id: orgData.org.id,
    slug,
    title,
    description: description || null,
    level_code: levelCode || 'ALL',
    is_active: true,
  })

  if (error) {
    console.error('[createLmsCourse]', JSON.stringify(error))
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
  revalidatePath('/lms')
}

export async function updateLmsCourse(formData: FormData) {
  const orgData = await assertOrgAdmin()

  const courseId = formData.get('courseId') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const levelCode = formData.get('levelCode') as string
  const isActive = formData.get('isActive') === 'true'

  if (!courseId || !title) throw new Error('ID dan Judul wajib diisi')

  const supabase = await createClient()
  const { error } = await supabase
    .from('learning_courses')
    .update({
      title,
      description: description || null,
      level_code: levelCode || 'ALL',
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', courseId)
    .eq('org_id', orgData.org.id)

  if (error) {
    console.error('[updateLmsCourse]', JSON.stringify(error))
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
  revalidatePath('/lms')
}

export async function deleteLmsCourse(courseId: string) {
  const orgData = await assertOrgAdmin()

  const supabase = await createClient()

  // Cek apakah ada batch yang masih aktif
  const { data: batches } = await supabase
    .from('lms_course_batches')
    .select('id')
    .eq('org_id', orgData.org.id)
    .eq('course_id', courseId)
    .limit(1)

  if (batches && batches.length > 0) {
    throw new Error('Hapus semua batch pada course ini terlebih dahulu sebelum menghapus course.')
  }

  const { error } = await supabase
    .from('learning_courses')
    .delete()
    .eq('id', courseId)
    .eq('org_id', orgData.org.id)

  if (error) {
    console.error('[deleteLmsCourse]', JSON.stringify(error))
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
  revalidatePath('/lms')
}

// ── Batches (Angkatan) ────────────────────────────────────────────────────────

export async function getLmsBatches(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lms_course_batches')
    .select('*, learning_courses(id, title, slug)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getLmsBatches]', error)
    return []
  }
  return data
}

export async function createLmsBatch(formData: FormData) {
  const orgData = await assertOrgAdmin()

  const courseId = formData.get('courseId') as string
  const name = formData.get('name') as string
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string
  const quota = Number(formData.get('quota') || 0)
  const price = Number(formData.get('price') || 0)
  const status = (formData.get('status') as string) || 'OPEN'
  const taxRate = Number(formData.get('taxRate') || 0)
  const isTaxIncluded = formData.get('isTaxIncluded') === 'on'

  const feeStructureStr = formData.get('feeStructure') as string
  const feeStructure = feeStructureStr ? JSON.parse(feeStructureStr) : []
  const costStructureStr = formData.get('costStructure') as string
  const costStructure = costStructureStr ? JSON.parse(costStructureStr) : []

  if (!courseId || !name) throw new Error('Program dan Nama Batch wajib diisi')

  const supabase = await createClient()
  const { error } = await supabase.from('lms_course_batches').insert({
    org_id: orgData.org.id,
    course_id: courseId,
    name,
    start_date: startDate || null,
    end_date: endDate || null,
    quota,
    price,
    fee_structure: feeStructure,
    cost_structure: costStructure,
    status,
    tax_rate: taxRate,
    is_tax_included: isTaxIncluded,
  })

  if (error) {
    console.error('[createLmsBatch]', JSON.stringify(error))
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
}

export async function updateLmsBatch(formData: FormData) {
  const orgData = await assertOrgAdmin()

  const batchId = formData.get('batchId') as string
  const name = formData.get('name') as string
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string
  const quota = Number(formData.get('quota') || 0)
  const price = Number(formData.get('price') || 0)
  const status = (formData.get('status') as string) || 'OPEN'
  const taxRate = Number(formData.get('taxRate') || 0)
  const isTaxIncluded = formData.get('isTaxIncluded') === 'on'

  if (!batchId || !name) throw new Error('ID dan Nama Batch wajib diisi')

  const supabase = await createClient()
  const { error } = await supabase
    .from('lms_course_batches')
    .update({
      name,
      start_date: startDate || null,
      end_date: endDate || null,
      quota,
      price,
      status,
      tax_rate: taxRate,
      is_tax_included: isTaxIncluded,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .eq('org_id', orgData.org.id)

  if (error) {
    console.error('[updateLmsBatch]', JSON.stringify(error))
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
}

export async function deleteLmsBatch(batchId: string) {
  const orgData = await assertOrgAdmin()

  const supabase = await createClient()

  // Cek apakah ada registrasi
  const { data: regs } = await supabase
    .from('lms_registrations')
    .select('id')
    .eq('org_id', orgData.org.id)
    .eq('batch_id', batchId)
    .limit(1)

  if (regs && regs.length > 0) {
    throw new Error('Batch ini sudah memiliki peserta terdaftar. Tidak bisa dihapus.')
  }

  const { error } = await supabase
    .from('lms_course_batches')
    .delete()
    .eq('id', batchId)
    .eq('org_id', orgData.org.id)

  if (error) {
    console.error('[deleteLmsBatch]', JSON.stringify(error))
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
}

// ── Sessions (Jadwal Sesi) ────────────────────────────────────────────────────

export async function getAllLmsSessions(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lms_batch_sessions')
    .select('*, lms_course_batches(id, name, learning_courses(title))')
    .eq('org_id', orgId)
    .order('start_time', { ascending: true })

  if (error) return []
  return data
}

export async function getLmsBatchSessions(orgId: string, batchId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lms_batch_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('batch_id', batchId)
    .order('start_time', { ascending: true })

  if (error) return []
  return data
}

export async function createLmsSession(formData: FormData) {
  const orgData = await assertOrgAdmin()

  const batchId = formData.get('batchId') as string
  const title = formData.get('title') as string
  const startTime = formData.get('startTime') as string
  const endTime = formData.get('endTime') as string
  const instructor = formData.get('instructorName') as string
  const locationUrl = formData.get('locationUrl') as string

  if (!batchId || !title || !startTime || !endTime) {
    throw new Error('Batch, Judul, Waktu Mulai, dan Waktu Selesai wajib diisi')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('lms_batch_sessions').insert({
    org_id: orgData.org.id,
    batch_id: batchId,
    title,
    start_time: new Date(startTime).toISOString(),
    end_time: new Date(endTime).toISOString(),
    instructor_name: instructor || null,
    location_url: locationUrl || null,
  })

  if (error) {
    console.error('[createLmsSession]', JSON.stringify(error))
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
}

export async function updateLmsSession(formData: FormData) {
  const orgData = await assertOrgAdmin()

  const sessionId = formData.get('sessionId') as string
  const title = formData.get('title') as string
  const startTime = formData.get('startTime') as string
  const endTime = formData.get('endTime') as string
  const instructor = formData.get('instructorName') as string
  const locationUrl = formData.get('locationUrl') as string

  if (!sessionId || !title || !startTime || !endTime) {
    throw new Error('ID, Judul, Waktu Mulai, dan Waktu Selesai wajib diisi')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('lms_batch_sessions')
    .update({
      title,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      instructor_name: instructor || null,
      location_url: locationUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('org_id', orgData.org.id)

  if (error) {
    console.error('[updateLmsSession]', JSON.stringify(error))
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
}

export async function deleteLmsSession(sessionId: string) {
  const orgData = await assertOrgAdmin()

  const supabase = await createClient()
  const { error } = await supabase
    .from('lms_batch_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('org_id', orgData.org.id)

  if (error) {
    console.error('[deleteLmsSession]', JSON.stringify(error))
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
}

// ── Lesson CRUD ───────────────────────────────────────────────────────────────

export async function getLmsLessonsByCourseId(orgId: string, courseId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learning_lessons')
    .select('*')
    .eq('org_id', orgId)
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })

  if (error) return []
  return data
}

export async function createLmsLesson(formData: FormData) {
  const orgData = await assertOrgAdmin()

  const courseId = formData.get('courseId') as string
  const title = formData.get('title') as string
  const contentMd = formData.get('contentMd') as string
  const lessonType = (formData.get('lessonType') as string) || 'TEXT'
  const sortOrder = parseInt(formData.get('sortOrder') as string) || 0
  const isRequired = formData.get('isRequired') !== 'false'

  if (!courseId || !title) throw new Error('Course ID dan judul wajib diisi')

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now()

  const supabase = await createClient()
  const { error } = await supabase.from('learning_lessons').insert({
    org_id: orgData.org.id,
    course_id: courseId,
    slug,
    title,
    content_md: contentMd || null,
    lesson_type: lessonType,
    sort_order: sortOrder,
    is_required: isRequired,
  })

  if (error) throw new Error(getErrorMessage(error))

  revalidatePath(`/lms/course/${formData.get('courseSlug') || ''}`)
  revalidatePath('/lms/admin')
}

export async function updateLmsLesson(formData: FormData) {
  const orgData = await assertOrgAdmin()

  const lessonId = formData.get('lessonId') as string
  const title = formData.get('title') as string
  const contentMd = formData.get('contentMd') as string
  const lessonType = (formData.get('lessonType') as string) || 'TEXT'
  const sortOrder = parseInt(formData.get('sortOrder') as string) || 0
  const isRequired = formData.get('isRequired') !== 'false'

  if (!lessonId || !title) throw new Error('ID dan judul wajib diisi')

  const supabase = await createClient()
  const { error } = await supabase
    .from('learning_lessons')
    .update({
      title,
      content_md: contentMd || null,
      lesson_type: lessonType,
      sort_order: sortOrder,
      is_required: isRequired,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonId)
    .eq('org_id', orgData.org.id)

  if (error) throw new Error(getErrorMessage(error))

  revalidatePath(`/lms/course/${formData.get('courseSlug') || ''}`)
  revalidatePath('/lms/admin')
}

export async function deleteLmsLesson(lessonId: string) {
  const orgData = await assertOrgAdmin()

  const supabase = await createClient()
  const { error } = await supabase
    .from('learning_lessons')
    .delete()
    .eq('id', lessonId)
    .eq('org_id', orgData.org.id)

  if (error) throw new Error(getErrorMessage(error))

  revalidatePath('/lms/admin')
  revalidatePath('/lms', 'layout')
}

// ── Internal helpers ──────────────────────────────────────────────────────────
