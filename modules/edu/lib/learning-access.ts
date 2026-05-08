import { hasRolePermission } from '@/modules/organization/lib/navigation-access'

/**
 * Memisahkan akses baca dan kelola learning agar tenant ERP bisa
 * mengelola peningkatan kompetensi sendiri tanpa bergantung pada flow SaaS.
 */
export function resolveLearningRoleAccess(
  userRole?: string | null,
  permissions?: string[] | null,
) {
  return {
    canRead: hasRolePermission(userRole, permissions, 'learning'),
    canManage: hasRolePermission(userRole, permissions, 'learning:write'),
  }
}
