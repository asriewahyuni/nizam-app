/**
 * ticket-constants.ts
 * Konstanta dan tipe untuk CRM Tiket Layanan — tanpa 'use server'
 * sehingga bisa diimport dari client components maupun server actions.
 */

export type CrmTicketType     = 'COMPLAINT' | 'REQUEST' | 'INQUIRY' | 'SUGGESTION'
export type CrmTicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type CrmTicketStatus   = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type CrmTicketSource   = 'CUSTOMER_FORM' | 'VENDOR_FORM' | 'STAFF'

export const TICKET_TYPE_LABEL: Record<CrmTicketType, string> = {
  COMPLAINT:  'Komplain',
  REQUEST:    'Permintaan',
  INQUIRY:    'Pertanyaan',
  SUGGESTION: 'Saran',
}

export const TICKET_PRIORITY_LABEL: Record<CrmTicketPriority, string> = {
  LOW:    'Rendah',
  MEDIUM: 'Sedang',
  HIGH:   'Tinggi',
  URGENT: 'Urgent',
}

export const TICKET_STATUS_LABEL: Record<CrmTicketStatus, string> = {
  NEW:         'Baru',
  IN_PROGRESS: 'Diproses',
  RESOLVED:    'Selesai',
  CLOSED:      'Ditutup',
}

export type CrmTicket = {
  id: string
  org_id: string
  branch_id: string | null
  ticket_number: string
  source: CrmTicketSource
  type: CrmTicketType
  priority: CrmTicketPriority
  status: CrmTicketStatus
  subject: string
  description: string | null
  resolution: string | null
  submitter_name: string
  submitter_email: string | null
  submitter_phone: string | null
  contact_id: string | null
  contact_name: string | null
  reference_type: 'SALE' | 'PURCHASE' | null
  reference_id: string | null
  reference_number: string | null
  assigned_to_user_id: string | null
  assigned_to_name: string | null
  due_date: string | null
  notification_email: string | null
  notification_phone: string | null
  resolved_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type CrmTicketNote = {
  id: string
  ticket_id: string
  author_name: string
  author_type: 'STAFF' | 'SYSTEM' | 'CUSTOMER'
  content: string
  is_internal: boolean
  created_at: string
}

export type CreateCrmTicketInput = {
  org_id: string
  branch_id?: string | null
  source?: CrmTicketSource
  type: CrmTicketType
  priority?: CrmTicketPriority
  subject: string
  description?: string | null
  submitter_name: string
  submitter_email?: string | null
  submitter_phone?: string | null
  notification_email?: string | null
  notification_phone?: string | null
}

export type UpdateCrmTicketInput = {
  status?: CrmTicketStatus
  priority?: CrmTicketPriority
  resolution?: string | null
  assigned_to_user_id?: string | null
  due_date?: string | null
  contact_id?: string | null
  reference_type?: 'SALE' | 'PURCHASE' | null
  reference_id?: string | null
}

export type CrmTicketFilters = {
  status?: CrmTicketStatus | 'ALL'
  type?: CrmTicketType | 'ALL'
  priority?: CrmTicketPriority | 'ALL'
  search?: string
}
