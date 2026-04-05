import fs from 'fs';
import path from 'path';

const authActionsPath = path.join(process.cwd(), 'modules/auth/actions/auth.actions.ts');
let content = fs.readFileSync(authActionsPath, 'utf8');

// 1. resolveRoleIdForEmployee
content = content.replace(
  /async function resolveRoleIdForEmployee\([\s\S]*?return matchingRole\?\.id \|\| null\n\}/,
`async function resolveRoleIdForEmployee(inviteRoleId: string | null | undefined, emp: any) {
  if (inviteRoleId) return inviteRoleId

  const allRoles = await prisma.roles.findMany({
    where: { org_id: emp.org_id },
    select: { id: true, name: true }
  })

  const matchingRole = allRoles?.find((role: any) =>
    role.name.toLowerCase().trim() === emp.job_title?.toLowerCase().trim()
  )

  return matchingRole?.id || null
}`
);

// 2. linkEmployeeToUser
content = content.replace(
  /async function linkEmployeeToUser\([\s\S]*?return \{ success: true as const \}\n\}/,
`async function linkEmployeeToUser(
  emp: any,
  userId: string,
  roleId: string | null,
) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.employees.update({
        where: { id: emp.id },
        data: {
          user_id: userId,
          employment_status: emp.employment_status || 'PROBATION',
          registration_status: 'REGISTERED',
        }
      })

      const existingMember = await tx.org_members.findFirst({
        where: { org_id: emp.org_id, user_id: userId }
      })

      if (existingMember) {
        await tx.org_members.update({
          where: { id: existingMember.id },
          data: { role: 'staff', role_id: roleId, is_active: true }
        })
      } else {
        await tx.org_members.create({
          data: {
            org_id: emp.org_id,
            user_id: userId,
            role: 'staff',
            role_id: roleId,
            is_active: true,
          }
        })
      }
    })
    return { success: true as const }
  } catch (err) {
    return { error: 'Gagal menautkan user ke data karyawan.' }
  }
}`
);

// 3. trackInvitationUsage
content = content.replace(
  /async function trackInvitationUsage\([\s\S]*?\.eq\('id', invite\.id\)\n\}/,
`async function trackInvitationUsage(invite: any) {
  const nextUseCount = Number(invite.use_count || 0) + 1
  const maxUses = Number(invite.max_uses || 0)
  const shouldDeactivate = maxUses > 0 && nextUseCount >= maxUses

  await prisma.org_invitations.update({
    where: { id: invite.id },
    data: {
      use_count: nextUseCount,
      ...(shouldDeactivate ? { is_active: false } : {}),
    }
  })
}`
);

// 4. getAuthEmailByUserId
content = content.replace(
  /async function getAuthEmailByUserId\([\s\S]*?return data\.user\?\.email\?\.trim\(\)\.toLowerCase\(\) \|\| fallbackEmail \|\| null\n\}/,
`async function getAuthEmailByUserId(
  userId: string,
  fallbackEmail?: string | null,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  })
  if (!user) return fallbackEmail || null
  return user.email?.trim().toLowerCase() || fallbackEmail || null
}`
);

// 5. resolvePreferredOrgIdForStaffLogin
content = content.replace(
  /async function resolvePreferredOrgIdForStaffLogin\([\s\S]*?return storedOrgId \|\| fallbackOrgId\n\}/,
`async function resolvePreferredOrgIdForStaffLogin(
  userId: string,
  orgIds: string[],
  fallbackOrgId: string,
) {
  const storedOrgId = await getStoredActiveOrgIdForUser(userId, orgIds)
  return storedOrgId || fallbackOrgId
}`
);

fs.writeFileSync(authActionsPath, content, 'utf8');
console.log('Helpers replaced successfully');
