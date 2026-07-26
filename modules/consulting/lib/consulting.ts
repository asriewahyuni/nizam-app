/**
 * Kontrak data Consulting 360 untuk checkout publik, admin, konsultan, dan member.
 */

export const CONSULTING_OFFERING_TYPE = 'CONSULTING_1_ON_1' as const

export type ConsultingOfferingType = typeof CONSULTING_OFFERING_TYPE
export type ConsultingDeliveryMode = 'ONLINE' | 'OFFLINE' | 'HYBRID'
export type ConsultingSessionStatus = 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'
export type ConsultingEngagementStatus =
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'COMPLETION_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'

export type PublicConsultingConsultant = {
  id: string
  displayName: string
  headline: string
  biography: string
  avatarUrl: string
  expertise: string[]
}

export type PublicConsultingOffering = {
  id: string
  commercialName: string
  sessionCount: number
  durationMinutes: number
  timezone: string
  bookingHorizonDays: number
  minimumNoticeHours: number
  rescheduleLimit: number
  rescheduleCutoffHours: number
  noShowConsumesSession: boolean
  deliveryMode: ConsultingDeliveryMode
  locationName: string
  intakeFields: Array<{
    key: string
    label: string
    required: boolean
    placeholder: string
  }>
  badge: {
    title: string
    description: string
    primaryColor: string
    accentColor: string
  } | null
  consultants: PublicConsultingConsultant[]
}

export type ConsultingAvailabilitySlot = {
  startsAt: string
  endsAt: string
  dateLabel: string
  timeLabel: string
}

export type ConsultingHoldResult = {
  holdToken: string
  expiresAt: string
  offeringId: string
  consultantId: string
  slots: ConsultingAvailabilitySlot[]
}

export type ConsultingAdminConsultant = PublicConsultingConsultant & {
  userId: string
  employeeId: string | null
  employeeName: string
}

export type ConsultingAdminOffering = {
  id: string
  storeId: string
  storeProductId: string
  productId: string
  publicName: string
  publicSlug: string
  shortDescription: string
  publicDescription: string
  price: number
  isPublished: boolean
  sessionCount: number
  durationMinutes: number
  timezone: string
  bookingHorizonDays: number
  minimumNoticeHours: number
  rescheduleLimit: number
  rescheduleCutoffHours: number
  noShowConsumesSession: boolean
  deliveryMode: ConsultingDeliveryMode
  locationName: string
  defaultMeetingUrl: string
  meetingProvider: string
  badgeTemplateId: string | null
  consultantIds: string[]
  weekdays: number[]
  startLocal: string
  endLocal: string
  courseIds: string[]
  packageIds: string[]
  intakeFields: PublicConsultingOffering['intakeFields']
  activeEngagements: number
}

export type ConsultingAdminOverview = {
  offerings: ConsultingAdminOffering[]
  consultants: ConsultingAdminConsultant[]
  badgeTemplates: Array<{
    id: string
    name: string
    title: string
    description: string
    primaryColor: string
    accentColor: string
  }>
  engagements: ConsultingPortalEngagement[]
}

export type ConsultingPortalSession = {
  id: string
  sequenceNumber: number
  startsAt: string
  endsAt: string
  status: ConsultingSessionStatus
  attendanceStatus: string
  deliveryMode: ConsultingDeliveryMode
  locationName: string
  meetingUrl: string
  meetingProvider: string
  rescheduleCount: number
  internalNotes: string
  memberSummary: string
}

export type ConsultingPortalEngagement = {
  id: string
  offeringId: string
  storeProductId: string
  storeSlug: string
  productName: string
  productSlug: string
  orderNumber: string
  memberName: string
  memberEmail: string
  userId: string
  consultantId: string
  consultantName: string
  consultantHeadline: string
  consultantAvatarUrl: string
  status: ConsultingEngagementStatus
  sessionCount: number
  completedSessionCount: number
  durationMinutes: number
  timezone: string
  goals: string
  actionPlan: string
  progressSummary: string
  finalSummary: string
  rescheduleLimit: number
  rescheduleCutoffHours: number
  noShowConsumesSession: boolean
  completionApprovedAt: string | null
  badge: {
    title: string
    badgeNumber: string
    verificationToken: string
    status: string
    awardedAt: string
    primaryColor: string
    accentColor: string
  } | null
  sessions: ConsultingPortalSession[]
}

export type PublicBadgeVerification = {
  holderName: string
  badgeTitle: string
  badgeDescription: string
  badgeNumber: string
  awardedAt: string
  status: 'ACTIVE' | 'REVOKED'
  programName: string
  consultantName: string
  primaryColor: string
  accentColor: string
}
