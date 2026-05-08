'use server'

import { revalidatePath } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { createClient } from '@/lib/supabase/server'
import { TRAINING_COURSES } from '@/modules/edu/lib/training-center-mvp'

function getErrorMessage(error: any) {
  return error instanceof Error ? error.message : 'Unknown error'
}

async function getOrCreateCourseIdBySlug(orgId: string, slug: string) {
  const supabase = await createClient()
  
  // Try to find existing
  const { data: existing } = await supabase
    .from('learning_courses')
    .select('id')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .single()
    
  if (existing) return existing.id
  
  // Find from MVP catalog
  const mvpCourse = TRAINING_COURSES.find(c => c.slug === slug)
  if (!mvpCourse) throw new Error('Course not found in catalog')
    
  // Insert new
  const { data: inserted, error } = await supabase
    .from('learning_courses')
    .insert({
      org_id: orgId,
      slug: mvpCourse.slug,
      title: mvpCourse.title,
      description: mvpCourse.description,
      level_code: mvpCourse.levelCode,
      is_active: mvpCourse.status === 'LIVE'
    })
    .select('id')
    .single()
    
  if (error) throw new Error(getErrorMessage(error))
  return inserted.id
}

export async function createLmsBatch(formData: FormData) {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')

  const courseSlug = formData.get('courseSlug') as string
  const name = formData.get('name') as string
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string
  const quota = Number(formData.get('quota') || 0)
  const price = Number(formData.get('price') || 0)
  const status = formData.get('status') as string || 'OPEN'
  
  // Parse JSON string fields for structures
  const feeStructureStr = formData.get('feeStructure') as string
  const feeStructure = feeStructureStr ? JSON.parse(feeStructureStr) : []
  
  const costStructureStr = formData.get('costStructure') as string
  const costStructure = costStructureStr ? JSON.parse(costStructureStr) : []

  if (!courseSlug || !name) {
    throw new Error('Course and Name are required')
  }

  const supabase = await createClient()

  // get course id
  const { data: course } = await supabase.from('learning_courses').select('id').eq('slug', courseSlug).eq('org_id', orgData.org.id).single()
  if (!course) throw new Error('Course not found')

  const { error } = await supabase.from('lms_course_batches').insert({
    org_id: orgData.org.id,
    course_id: course.id,
    name,
    start_date: startDate || null,
    end_date: endDate || null,
    quota,
    price,
    fee_structure: feeStructure,
    cost_structure: costStructure,
    status,
    tax_rate: Number(formData.get('taxRate') || 0),
    is_tax_included: formData.get('isTaxIncluded') === 'on'
  })

  if (error) {
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
}

export async function getLmsBatches(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lms_course_batches')
    .select('*, learning_courses(title)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching batches:', error)
    return []
  }

  return data
}

export async function getLmsCourses(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learning_courses')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching courses:', error)
    return []
  }

  return data
}

export async function createLmsCourse(formData: FormData) {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const levelCode = formData.get('levelCode') as string

  if (!title) {
    throw new Error('Title is required')
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')

  const supabase = await createClient()

  const { error } = await supabase.from('learning_courses').insert({
    org_id: orgData.org.id,
    slug,
    title,
    description,
    level_code: levelCode || 'ALL',
    is_active: true
  })

  if (error) {
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
  revalidatePath('/lms')
}

export async function getLmsCourseBySlug(orgId: string, slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learning_courses')
    .select('*')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .single()

  if (error) {
    console.error('Error fetching course by slug:', error)
    return null
  }
  return data
}

export async function getLmsLessonsByCourseId(orgId: string, courseId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learning_lessons')
    .select('*')
    .eq('org_id', orgId)
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })

  if (error) {
    return []
  }
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

  if (error) {
    return []
  }
  return data
}

export async function getAllLmsSessions(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lms_batch_sessions')
    .select('*, lms_course_batches(name, learning_courses(title))')
    .eq('org_id', orgId)
    .order('start_time', { ascending: true })

  if (error) {
    return []
  }
  return data
}

export async function createLmsSession(formData: FormData) {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')

  const batchId = formData.get('batchId') as string
  const title = formData.get('title') as string
  const startTime = formData.get('startTime') as string
  const endTime = formData.get('endTime') as string
  const instructor = formData.get('instructorName') as string
  const locationUrl = formData.get('locationUrl') as string

  if (!batchId || !title || !startTime || !endTime) {
    throw new Error('Batch, Title, Start Time, and End Time are required')
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
    throw new Error(getErrorMessage(error))
  }

  revalidatePath('/lms/admin')
}
