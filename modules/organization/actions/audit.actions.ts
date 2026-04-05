'use server'

import { auth } from '@/auth'
import { getMembership } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

function buildAuditDescription(action: string, tableName: string) {
  switch (String(action || '').toUpperCase()) {
    case 'CREATE':
      return `Menambahkan data baru di ${tableName}`
    case 'UPDATE':
      return `Mengubah data di ${tableName}`
    case 'DELETE':
      return `Menghapus data dari ${tableName}`
    case 'VOID':
      return `Membatalkan (VOID) transaksi di ${tableName}`
    default:
      return `${action} pada ${tableName}`
  }
}

export async function getAuditLogs(orgId: string, limit: number = 50) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new Error('Unauthorized')

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return []

  const membership = await getMembership(userId, trimmedOrgId)
  if (!membership?.isOwnerOrAdmin) {
    return []
  }

  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 50

  const logs = await prisma.audit_logs.findMany({
    where: {
      org_id: trimmedOrgId,
    },
    orderBy: {
      created_at: 'desc',
    },
    take: normalizedLimit,
    select: {
      id: true,
      org_id: true,
      created_at: true,
      user_id: true,
      action: true,
      table_name: true,
      record_id: true,
      old_data: true,
      new_data: true,
    },
  })

  const userIds = Array.from(
    new Set(
      logs
        .map((log) => String(log.user_id || '').trim())
        .filter(Boolean)
    )
  )

  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
    : []

  const usersById = new Map(users.map((entry) => [entry.id, entry]))

  return logs.map((log) => {
    const actor = log.user_id ? usersById.get(log.user_id) : null
    return {
      id: log.id,
      org_id: log.org_id,
      created_at: log.created_at.toISOString(),
      user_email: actor?.email || 'System / User',
      user_name: actor?.name || actor?.email || 'Logged Actor',
      action: log.action,
      table_name: log.table_name,
      record_id: log.record_id,
      old_data: log.old_data,
      new_data: log.new_data,
      description: buildAuditDescription(log.action, log.table_name),
    }
  })
}
