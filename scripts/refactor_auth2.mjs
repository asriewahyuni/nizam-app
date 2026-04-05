import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'modules/auth/actions/auth.actions.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /async function resolveExistingStaffIdentity\([\s\S]*?return \{ userId: existingEmployee\.user_id, authEmail \}\n\}/,
`async function resolveExistingStaffIdentity(
  emp: any,
  nik: string,
  password: string,
) {
  const session = await auth()
  const currentUser = session?.user
  const normalizedEmail = normalizeEmail(emp.email)

  if (currentUser?.id) {
    if (normalizedEmail) {
      const linkedSelf = await prisma.employees.findFirst({
        where: { user_id: currentUser.id, email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: { id: true }
      })

      if (linkedSelf) {
        return { userId: currentUser.id, authEmail: currentUser.email?.trim().toLowerCase() || null }
      }
    }
  }

  if (!normalizedEmail) return null

  const existingEmployee = await prisma.employees.findFirst({
    where: {
      id: { not: emp.id },
      email: { equals: normalizedEmail, mode: 'insensitive' },
      user_id: { not: null }
    },
    orderBy: { created_at: 'asc' },
    select: { user_id: true }
  })

  if (!existingEmployee?.user_id) return null

  const authEmail = await getAuthEmailByUserId(existingEmployee.user_id)
  if (!authEmail) {
    return { error: 'Akun karyawan terdeteksi di organisasi lain, tetapi email login tidak ditemukan. Hubungi admin.' }
  }

  const existingUser = await prisma.user.findUnique({ where: { email: authEmail } })
  if (!existingUser || !existingUser.password || !bcrypt.compareSync(password, existingUser.password)) {
    return { error: 'Akun Anda sudah terhubung ke organisasi lain. Password salah.' }
  }

  return { userId: existingEmployee.user_id, authEmail }
}`
);

content = content.replace(
  /export async function registerEmployeeAccount\([\s\S]*?return \{ success: true, redirectTo: '\/dashboard' \}\n\}/,
`export async function registerEmployeeAccount(formData: FormData) {
  const cookieStore = await cookies()

  const nik = (formData.get('nik') as string)?.trim().toUpperCase()
  const password = (formData.get('password') as string)
  const inviteId = (formData.get('invite_id') as string)

  if (!nik || !password || password.length < 8 || !inviteId) {
    return { error: 'Data aktivasi tidak lengkap. Pastikan NIK, password, dan token valid.' }
  }

  const invite = await prisma.org_invitations.findUnique({
    where: { id: inviteId },
    select: { id: true, org_id: true, role_id: true, use_count: true, max_uses: true, is_active: true, expires_at: true }
  })

  if (!invite) return { error: 'Link aktivasi tidak ditemukan.' }
  if (!invite.is_active) return { error: 'Link aktivasi sudah dinonaktifkan.' }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { error: 'Link aktivasi sudah kadaluarsa.' }
  }
  if (Number(invite.max_uses || 0) > 0 && Number(invite.use_count || 0) >= Number(invite.max_uses || 0)) {
    return { error: 'Link aktivasi sudah mencapai batas penggunaan.' }
  }

  const emp = await prisma.employees.findFirst({
    where: { org_id: invite.org_id, nik: nik }
  })

  if (!emp) return { error: 'NIK tidak valid atau tidak ditemukan di organisasi ini.' }
  if (emp.user_id) return { error: 'NIK ini sudah memiliki akun aktif. Silakan Login.' }

  const roleId = await resolveRoleIdForEmployee(invite?.role_id, emp)

  const existingIdentity = await resolveExistingStaffIdentity(emp, nik, password)
  if (existingIdentity && 'error' in existingIdentity) {
    return { error: existingIdentity.error }
  }

  if (existingIdentity?.userId) {
    const linkResult = await linkEmployeeToUser(emp, existingIdentity.userId, roleId)
    if ('error' in linkResult) return linkResult

    await trackInvitationUsage(invite)
    await persistMembershipActiveContext({
      userId: existingIdentity.userId,
      orgId: emp.org_id,
      branchId: emp.branch_id ? String(emp.branch_id) : null,
    })
    setActiveOrganizationCookie(cookieStore, emp.org_id)

    revalidatePath('/', 'layout')
    return { success: true, redirectTo: '/dashboard' }
  }

  const internalEmail = buildInternalStaffEmail(emp.org_id, nik)
  const hashedPassword = bcrypt.hashSync(password, 10)

  let authData;
  try {
    authData = await prisma.user.create({
      data: {
        email: internalEmail,
        password: hashedPassword,
        name: \`\${emp.first_name} \${emp.last_name}\`,
      }
    })
  } catch (authErr: any) {
    return { error: authErr.message || 'Gagal membuat akun autentikasi.' }
  }

  const userId = authData.id
  if (!userId) return { error: 'Gagal membuat user ID.' }

  const linkResult = await linkEmployeeToUser(emp, userId, roleId)
  if ('error' in linkResult) return linkResult

  await trackInvitationUsage(invite)

  try {
    await nextAuthSignIn('credentials', { 
      email: internalEmail, 
      password,
      redirect: false
    })
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { error: 'Akun berhasil dibuat, tapi login otomatis gagal. Silakan login manual pakai NIK & password baru.' }
    }
    throw error;
  }

  await persistMembershipActiveContext({
    userId,
    orgId: emp.org_id,
    branchId: emp.branch_id ? String(emp.branch_id) : null,
  })
  setActiveOrganizationCookie(cookieStore, emp.org_id)
  revalidatePath('/', 'layout')
  return { success: true, redirectTo: '/dashboard' }
}`
);

content = content.replace(
  /export async function verifyEmployeeNikByToken\([\s\S]*?return \{ success: true, employee: emp, org: orgRes\?\.data \|\| null, invite: invitePayload \}\n\}/,
`export async function verifyEmployeeNikByToken(token: string, nik: string) {
  const normalizedToken = token.toUpperCase().trim()
  const normalizedNik = nik.trim().toUpperCase()

  const invite = await prisma.org_invitations.findFirst({
    where: { invitation_code: normalizedToken },
    select: { id: true, org_id: true, role_id: true, label: true, invitation_code: true, expires_at: true, is_active: true, max_uses: true, use_count: true, created_at: true }
  })

  if (!invite) return { error: 'Link aktivasi tidak ditemukan.' }
  if (!invite.is_active) return { error: 'Link aktivasi sudah dinonaktifkan oleh admin.' }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { error: 'Link aktivasi sudah kadaluarsa.' }
  }
  if (Number(invite.max_uses || 0) > 0 && Number(invite.use_count || 0) >= Number(invite.max_uses || 0)) {
    return { error: 'Link aktivasi sudah mencapai batas penggunaan.' }
  }

  const emp = await prisma.employees.findFirst({
    where: { org_id: invite.org_id, nik: normalizedNik },
    select: { id: true, first_name: true, last_name: true, user_id: true, org_id: true }
  })

  if (!emp) return { error: 'NIK Anda tidak terdaftar di bisnis ini.' }
  if (emp.user_id) return { error: 'NIK ini sudah memiliki akun aktif. Silakan Login.' }

  const [orgRes, roleRes] = await Promise.all([
    prisma.organizations.findUnique({
      where: { id: invite.org_id },
      select: { id: true, name: true, logo_url: true }
    }),
    invite.role_id
      ? prisma.roles.findUnique({
          where: { id: invite.role_id },
          select: { id: true, name: true }
        })
      : Promise.resolve(null),
  ])

  const invitePayload = {
    ...invite,
    roles: roleRes || null,
  }

  return { success: true, employee: emp, org: orgRes || null, invite: invitePayload }
}`
);

content = content.replace(
  /export async function signInWithNik\([\s\S]*?return redirect\(`\/login\?error=\$\{encodeURIComponent\('NIK atau password salah\.'\)\}&tab=karyawan`\)\n\}/,
`export async function signInWithNik(formData: FormData) {
  const cookieStore = await cookies()

  let nik = (formData.get('nik') as string)?.trim()
  const password = (formData.get('password') as string)
  const redirectTo = (formData.get('redirectTo') as string)

  if (!nik || !password) {
     return redirect(\`/login?error=\${encodeURIComponent('NIK dan Password wajib diisi.')}&tab=karyawan\`)
  }

  nik = nik.toUpperCase()
  const activeOrgIdPreference = cookieStore.get(ACTIVE_ORG_COOKIE)?.value?.trim() || null

  const employees = await prisma.employees.findMany({
    where: { nik: nik },
    select: { id: true, org_id: true, user_id: true, created_at: true },
    orderBy: { created_at: 'asc' }
  })

  if (employees.length === 0) {
    return redirect(\`/login?error=\${encodeURIComponent('NIK tidak ditemukan.')}&tab=karyawan\`)
  }

  const loginCandidates = buildStaffLoginCandidates(employees, nik, activeOrgIdPreference)
  if (loginCandidates.length === 0) {
    return redirect(\`/login?error=\${encodeURIComponent('Akun belum diaktivasi. Silakan pendaftaran terlebih dahulu.')}&tab=karyawan\`)
  }

  for (const candidate of loginCandidates) {
    const authEmail = await getAuthEmailByUserId(candidate.userId, candidate.authEmailFallback)
    if (!authEmail) continue

    let loginError = false;
    try {
      await nextAuthSignIn('credentials', {
        email: authEmail,
        password,
        redirect: false,
      })
    } catch (error) {
      if (error instanceof AuthError) {
        loginError = true;
      } else {
        throw error;
      }
    }

    if (!loginError) {
      const preferredOrgId = activeOrgIdPreference && candidate.orgIds.includes(activeOrgIdPreference)
        ? activeOrgIdPreference
        : await resolvePreferredOrgIdForStaffLogin(
            candidate.userId,
            candidate.orgIds,
            candidate.preferredOrgId
          )

      setActiveOrganizationCookie(cookieStore, preferredOrgId)
      revalidatePath('/', 'layout')
      return redirect(redirectTo || '/dashboard')
    }
  }

  return redirect(\`/login?error=\${encodeURIComponent('NIK atau password salah.')}&tab=karyawan\`)
}`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Done refactoring');
