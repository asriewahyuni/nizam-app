'use client'

import React, { startTransition, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  requestPasswordReset,
  resetEmployeePassword,
  signInAsTenantHrisUser,
} from '@/modules/auth/actions/auth.actions'
import { uploadEmployeeAvatar } from '@/modules/hris/actions/employee.actions'
import {
  Plus,
  Users,
  ShieldCheck,
  Banknote,
  CalendarDays,
  X,
  Check,
  Trash2,
  Edit2,
  Link as LinkIcon,
  Eye,
  Printer,
  ArrowRightLeft,
  Briefcase,
  Clock,
  ChevronRight,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  Wallet,
  AlertTriangle,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  Key,
  FileText,
  MessageCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useActiveOrgId } from '@/lib/hooks/useActiveOrgId'
import { createEmployee, deleteEmployee, resignEmployee, transferEmployeeToChildOrg, updateEmployee } from '@/modules/hris/actions/employee.actions'
import { createPayrollComponent, deletePayrollComponent, generatePayrollRun, payPayrollRun, fixEmptyPayrollJournals, getPayrollRunDetails, deletePayrollRun, voidPayrollRun } from '@/modules/hris/actions/payroll.actions'
import { upsertAttendanceRecord } from '@/modules/hris/actions/attendance.actions'
import { approveLeaveRequest, createLeaveRequest, rejectLeaveRequest } from '@/modules/hris/actions/leave.actions'
import {
  deleteOrganizationRole,
  getRolesForOrganization,
  saveOrganizationRole,
} from '@/modules/organization/actions/roles.actions'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { formatRupiah, formatDate } from '@/lib/utils'
import {
  PageHeader,
  StatCard,
  SectionCard,
  SectionHeader,
  StatusBadge,
  SafeButton,
  ConfirmDialog,
  EmptyState
} from '@/components/ui/NizamUI'

type AdminImpersonationInfo = {
  email?: string | null
  activeOrgId?: string | null
}

type HrisImpersonationTarget = {
  rawUserId?: string | null
  targetUserId?: string | null
  displayName?: string | null
  email?: string | null
  nik?: string | null
  roleLabel?: string | null
  branchName?: string | null
  isCurrentUser?: boolean
}

export default function HrisClient({
  orgId,
  allEmployees = [],
  currentUserId = '',
  activeBranchId = null,
  activeBranchName = null,
  allowAllBranchSelection = true,
  initialEmployees,
  initialPayrollComponents = [],
  initialPayrollRuns = [],
  initialAttendanceRecords = [],
  initialLeaveRequests = [],
  accounts = [],
  settings = {},
  roles = [],
  branches: branchOptions = [],
  childOrgOptions = [],
  transferTargets = [],
  transferDisabledReason = null,
  initialTransferHistory = [],
  initialInvitations = [],
  adminImpersonation = null,
  hrisImpersonationTargets = [],
  defaultTab
}: {
  orgId: string,
  allEmployees?: any[],
  currentUserId?: string,
  activeBranchId?: string | null,
  activeBranchName?: string | null,
  allowAllBranchSelection?: boolean,
  initialEmployees: any[],
  initialPayrollComponents?: any[],
  initialPayrollRuns?: any[],
  initialAttendanceRecords?: any[],
  initialLeaveRequests?: any[],
  accounts?: any[],
  settings?: any,
  roles?: any[],
  branches?: any[],
  childOrgOptions?: any[],
  transferTargets?: any[],
  transferDisabledReason?: string | null,
  initialTransferHistory?: any[],
  initialInvitations?: any[],
  adminImpersonation?: AdminImpersonationInfo | null,
  hrisImpersonationTargets?: HrisImpersonationTarget[],
  defaultTab?: string
}) {
  const router = useRouter()
  const [employees, setEmployees] = useState(initialEmployees)
  const [payrollComponents, setPayrollComponents] = useState(initialPayrollComponents)
  const [payrollRuns, setPayrollRuns] = useState(initialPayrollRuns || [])
  const [attendanceRecords, setAttendanceRecords] = useState(initialAttendanceRecords || [])
  const [leaveRequests, setLeaveRequests] = useState(initialLeaveRequests || [])
  const [invitations, setInvitations] = useState(initialInvitations || [])
  const [rolesList, setRolesList] = useState(roles || []) 
  const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'POSITIONS' | 'PAYROLL' | 'ATTENDANCE' | 'RUNS' | 'ACTIVATION'>(defaultTab as any || 'EMPLOYEES')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false)
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isPositionModalOpen, setIsPositionModalOpen] = useState(false)
  const [isHrisImpersonationModalOpen, setIsHrisImpersonationModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<any>(null)
  const [impersonatingTargetUserId, setImpersonatingTargetUserId] = useState<string | null>(null)
  const [baseUrl, setBaseUrl] = useState('https://nizam.app')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab as any)
  }, [defaultTab])

  useEffect(() => {
    setEmployees(initialEmployees)
  }, [initialEmployees])

  useEffect(() => {
    setPayrollComponents(initialPayrollComponents || [])
  }, [initialPayrollComponents])

  useEffect(() => {
    setPayrollRuns(initialPayrollRuns || [])
  }, [initialPayrollRuns])

  useEffect(() => {
    setAttendanceRecords(initialAttendanceRecords || [])
  }, [initialAttendanceRecords])

  useEffect(() => {
    setLeaveRequests(initialLeaveRequests || [])
  }, [initialLeaveRequests])

  useEffect(() => {
    setInvitations(initialInvitations || [])
  }, [initialInvitations])

  const [editingEmp, setEditingEmp] = useState<any>(null)
  const [selectedManagedBranches, setSelectedManagedBranches] = useState<string[]>([])
  const [selectedManagedChildOrgs, setSelectedManagedChildOrgs] = useState<string[]>([])
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferingEmp, setTransferingEmp] = useState<any>(null)
  const [transferTargetOrgId, setTransferTargetOrgId] = useState('')
  const [transferTargetBranchId, setTransferTargetBranchId] = useState('')
  const [transferAsTargetPic, setTransferAsTargetPic] = useState(false)
  const [transferNote, setTransferNote] = useState('')
  const [transferHistory, setTransferHistory] = useState<any[]>(() => initialTransferHistory || [])
  const [viewingRun, setViewingRun] = useState<any>(null)
  const [viewingRunData, setViewingRunData] = useState<any[]>([])
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resetModalEmp, setResetModalEmp] = useState<any>(null)
  const [resetModalPwd, setResetModalPwd] = useState('nizam123')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleResetPassword = (emp: any) => {
    setResetModalEmp(emp)
    setResetModalPwd('nizam123')
  }

  const submitPasswordReset = async (sendToWa: boolean = false) => {
    if (!resetModalEmp || !resetModalPwd) return
    const empId = resetModalEmp.id
    const empName = resetModalEmp.first_name
    
    setResettingId(empId)
    const res = await resetEmployeePassword(empId, resetModalPwd)
    setResettingId(null)
    
    if (res.error) {
      showToast('Gagal reset: ' + res.error, 'error')
    } else {
      showToast('Password berhasil direset!', 'success')
      if (sendToWa) {
         const text = `Halo *${empName}*,\n\nSaya Admin HR.\nPassword akun HRIS NIZAM Anda telah direset sementara menjadi:\n\n🔐 *${resetModalPwd}*\n\nSilakan login menggunakan NIK Anda di aplikasi dan segera ubah password Anda demi keamanan.`
         window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
      }
      setResetModalEmp(null)
    }
  }
  const [isRunModalOpen, setIsRunModalOpen] = useState(false)
  const [isPayModalOpen, setIsPayModalOpen] = useState<any>(null) // selected run to pay
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('')

  // Use shared hook — same org_id resolution as Settings/Roles and getActiveOrg()
  const { orgId: activeOrgId } = useActiveOrgId()

  // Sync roles whenever activeOrgId resolves
  useEffect(() => {
    if (!activeOrgId) return
    getRolesForOrganization(activeOrgId).then(({ data, error }) => {
      if (!error && Array.isArray(data)) {
        setRolesList(data)
      }
    })
  }, [activeOrgId])

  // Basic Form State
  const [basicSalary, setBasicSalary] = useState(0)
  const [payrollAmount, setPayrollAmount] = useState(0)
  const [isPercentage, setIsPercentage] = useState(false)
  const [isTaxable, setIsTaxable] = useState(true)
  const [componentType, setComponentType] = useState('EARNING')
  const [componentNameOption, setComponentNameOption] = useState('Tunjangan Makan')
  const [customComponentName, setCustomComponentName] = useState('')

  const PREDEFINED_COMPONENTS: Record<string, any> = {
    'Tunjangan Makan': { type: 'EARNING', is_taxable: true, is_percentage: false },
    'Tunjangan Transport': { type: 'EARNING', is_taxable: true, is_percentage: false },
    'BPJS Kesehatan (Karyawan)': { type: 'DEDUCTION', is_taxable: false, is_percentage: true, amount: 1 },
    'BPJS Ketenagakerjaan JHT (Karyawan)': { type: 'DEDUCTION', is_taxable: false, is_percentage: true, amount: 2 },
    'PPh 21': { type: 'TAX', is_taxable: false, is_percentage: false },
    'Potongan Koperasi': { type: 'DEDUCTION', is_taxable: false, is_percentage: false },
  }

  const handleComponentSelect = (val: string) => {
    setComponentNameOption(val)
    const pref = PREDEFINED_COMPONENTS[val]
    if (pref) {
      setComponentType(pref.type)
      setIsPercentage(pref.is_percentage)
      setIsTaxable(pref.is_taxable)
      if (pref.amount !== undefined) setPayrollAmount(pref.amount)
      else setPayrollAmount(0)
    }
  }

  const getManagedChildOrgIdsByEmployee = (emp: any) => {
    if (!emp?.id) return []

    const managedFromEmployeeRecord = Array.isArray(emp?.managed_child_orgs)
      ? emp.managed_child_orgs
          .map((org: any) => String(org?.id || '').trim())
          .filter(Boolean)
      : []

    if (managedFromEmployeeRecord.length > 0) {
      return managedFromEmployeeRecord
    }

    return (childOrgOptions || [])
      .filter((org: any) => String(org?.manager_employee_id || '').trim() === String(emp.id))
      .map((org: any) => String(org?.id || '').trim())
      .filter(Boolean)
  }

  const handleOpenNew = () => {
    if (!activeBranchId) {
      showToast('Pilih unit aktif terlebih dahulu untuk menambahkan karyawan baru.', 'info')
      return
    }

    setEditingEmp(null)
    setBasicSalary(0)
    setSelectedRole('')
    setAvatarFile(null)
    setAvatarPreview(null)
    setSelectedManagedBranches([])
    setSelectedManagedChildOrgs([])
    setIsAddModalOpen(true)
  }

  const handleOpenEdit = (emp: any) => {
    setEditingEmp(emp)
    setBasicSalary(emp.basic_salary || 0)
    setSelectedRole(emp.job_title || '')
    setAvatarFile(null)
    setAvatarPreview(emp.avatar_url || null)
    setSelectedManagedBranches(emp.managed_branches?.map((b: any) => b.id) || [])
    setSelectedManagedChildOrgs(getManagedChildOrgIdsByEmployee(emp))
    setIsAddModalOpen(true)
  }

  const handleCreateEmp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    const formTarget = e.currentTarget as HTMLFormElement

    // Upload avatar first if one was selected
    if (avatarFile) {
      const tempId = editingEmp?.id || `new-${Date.now()}`
      const res = await uploadEmployeeAvatar(avatarFile, tempId)
      if (res.url) formData.set('avatar_url', res.url)
    }
    formData.set('basic_salary', basicSalary.toString())
    formData.append('managed_branches', JSON.stringify(selectedManagedBranches))
    formData.append('managed_child_orgs', JSON.stringify(selectedManagedChildOrgs))

    const res = editingEmp
      ? await updateEmployee(editingEmp.id, orgId, formData)
      : await createEmployee(orgId, formData)

    if (res.error) showToast(res.error, 'error')
    else {
      if (editingEmp) {
        setIsAddModalOpen(false)
        showToast('Data karyawan berhasil diperbarui!', 'success')
      } else {
        const formTarget = e.target as HTMLFormElement;
        formTarget.reset();
        setBasicSalary(0);
        setSelectedManagedBranches([])
        setSelectedManagedChildOrgs([])
        // Alert non-intrusif memberitahu berhasil
        showToast('Data Karyawan berhasil disimpan!', 'success')
      }
      if (res.warning) showToast(res.warning, 'info')
    }
    setLoading(false)
  }

  const handleCreatePayrollComponent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.append('amount', payrollAmount.toString())

    const res = await createPayrollComponent(orgId, formData)
    if (res.error) showToast(res.error, 'error')
    else {
      setIsPayrollModalOpen(false)
    }
    setLoading(false)
  }

  const handleCreateInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const { createInvitationToken } = await import('@/modules/organization/actions/org.actions')
    const res = await createInvitationToken(orgId, formData)
    
    if (res.error) showToast(res.error, 'error')
    else {
      if (res.invitation) {
        setInvitations((current: any[]) => [res.invitation, ...current.filter((invite: any) => invite.id !== res.invitation.id)])
      }
      setIsInviteModalOpen(false)
      showToast('Link aktivasi berhasil dibuat.', 'success')
    }
    setLoading(false)
  }

  const fetchRoles = async () => {
    const targetOrgId = activeOrgId || orgId
    if (!targetOrgId) return
    const { data, error } = await getRolesForOrganization(targetOrgId)
    if (!error && Array.isArray(data)) setRolesList(data)
  }

  const handleSavePosition = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string

    if (editingPosition) {
       const { error } = await saveOrganizationRole(orgId, {
         id: editingPosition.id,
         name,
         departmentIds: editingPosition.department_ids || [],
         parentId: editingPosition.parent_id || null,
       })
       if (error) showToast(error, 'error')
       else { setIsPositionModalOpen(false); fetchRoles(); }
    } else {
       const { error } = await saveOrganizationRole(orgId, {
         name,
         departmentIds: [],
         parentId: null,
       })
       if (error) showToast(error, 'error')
       else { setIsPositionModalOpen(false); fetchRoles(); }
    }
    setLoading(false)
  }

  const handleDeletePosition = async (id: string, isSystem: boolean) => {
    if (isSystem) return showToast('Role sistem ini tidak dapat dihapus.', 'error')
    if (!confirm('Yakin ingin menghapus Posisi/Jabatan ini?')) return
    const { error } = await deleteOrganizationRole(orgId, id)
    if (error) showToast(error, 'error')
    else fetchRoles()
  }

  const handleDeleteInvite = async (id: string) => {
    if (!confirm('Hapus link aktivasi ini?')) return
    const { deleteInvitation } = await import('@/modules/organization/actions/org.actions')
    const res = await deleteInvitation(id)
    if (res.success) setInvitations(invitations.filter((i: any) => i.id !== id))
  }

  const handleDeletePayrollComponent = async (id: string) => {
    if (!confirm('Yakin ingin menghapus komponen ini? Semua keterkaitan karyawan dengan tunjangan/potongan ini bisa terpengaruh.')) return
    setLoading(true)
    const res = await deletePayrollComponent(id)
    if (res.error) showToast(res.error, 'error')
    else setPayrollComponents(payrollComponents.filter((p: any) => p.id !== id))
    setLoading(false)
  }

  const handleImpersonateHrisUser = (candidate: HrisImpersonationTarget) => {
    const targetUserId = String(candidate?.targetUserId || '').trim()
    const displayName = String(candidate?.displayName || 'akun target').trim()
    const rawUserId = String(candidate?.rawUserId || '').trim()
    const isCurrentTarget = Boolean(candidate?.isCurrentUser) || rawUserId === currentUserId || targetUserId === currentUserId

    if (!targetUserId) {
      showToast('Target akun HRIS tidak valid.', 'error')
      return
    }

    if (isCurrentTarget) {
      showToast('Anda sudah berada di akun HRIS ini.', 'info')
      return
    }

    if (!window.confirm(`Sesi tenant saat ini akan diganti menjadi ${displayName}. Lanjutkan impersonation HRIS?`)) {
      return
    }

    setImpersonatingTargetUserId(targetUserId)
    startTransition(async () => {
      const result = await signInAsTenantHrisUser(orgId, targetUserId)
      if (result?.error) {
        showToast(result.error, 'error')
        setImpersonatingTargetUserId(null)
        return
      }
      showToast('Mengalihkan sesi ke akun HRIS...', 'info')
    })
  }

  const handleDeleteEmployee = async (emp: any) => {
    if (!confirm(`Yakin ingin menghapus karyawan ${emp.first_name} ${emp.last_name || ''}?`)) return
    setLoading(true)
    const res = await deleteEmployee(emp.id, orgId)
    if (res.error) {
      showToast(res.error, 'error')
    } else {
      setEmployees((current) => current.filter((row: any) => row.id !== emp.id))
      showToast('Karyawan berhasil dihapus.', 'success')
      refreshHrisPage()
    }
    setLoading(false)
  }

  const handleResignEmployee = async (emp: any) => {
    const currentStatus = String(emp?.employment_status || '').toUpperCase()
    if (currentStatus === 'RESIGNED') {
      showToast('Karyawan ini sudah berstatus RESIGNED.', 'info')
      return
    }

    if (!confirm(`Tandai ${emp.first_name} ${emp.last_name || ''} sebagai RESIGNED?`)) return

    const reasonInput = window.prompt('Alasan resign (opsional):', '') || ''
    const effectiveDateInput = window.prompt('Tanggal efektif resign (YYYY-MM-DD, kosongkan untuk hari ini):', '') || ''

    setLoading(true)
    const res = await resignEmployee(emp.id, orgId, {
      reason: reasonInput,
      effectiveDate: effectiveDateInput,
    })

    if (res.error) {
      showToast(res.error, 'error')
      setLoading(false)
      return
    }

    const fallbackDate = new Date().toISOString().split('T')[0]
    setEmployees((current: any[]) =>
      current.map((row: any) =>
        row.id === emp.id
          ? {
              ...row,
              employment_status: 'RESIGNED',
              end_date: res.effectiveDate || effectiveDateInput || fallbackDate,
            }
          : row
      )
    )
    showToast(
      res.warning
        ? `Status resign tersimpan, dengan catatan: ${res.warning}`
        : 'Status karyawan berhasil diubah ke RESIGNED.',
      res.warning ? 'info' : 'success'
    )
    refreshHrisPage()
    setLoading(false)
  }

  const getNextNik = () => {
    const rawFormat = settings?.emp_format || 'EMP{MM}{YY}{0000}'

    // Resolve date variables
    const now = new Date()
    const MM = (now.getMonth() + 1).toString().padStart(2, '0')
    const YY = now.getFullYear().toString().substring(2)
    const YYYY = now.getFullYear().toString()
    const DD = now.getDate().toString().padStart(2, '0')

    const formatStr = rawFormat
      .replace('{MM}', MM)
      .replace('{YY}', YY)
      .replace('{YYYY}', YYYY)
      .replace('{DD}', DD)

    // Find the {00..} part
    const zeroMatch = formatStr.match(/\{0+\}/)
    if (!zeroMatch) return formatStr // Fallback if no digits specified

    const digitStr = zeroMatch[0] // e.g. "{0000}"
    const digitsCount = digitStr.length - 2 // e.g. 4

    // The prefix is everything before the zeros
    const splitFormat = formatStr.split(digitStr)
    const literalPrefix = splitFormat[0]

    let maxNum = 0
    const nikSource = allEmployees.length > 0 ? allEmployees : employees
    nikSource.forEach((emp: any) => {
      // Basic extraction matching the literalPrefix
      if (emp.nik && emp.nik.startsWith(literalPrefix)) {
        const potentialNum = emp.nik.substring(literalPrefix.length, literalPrefix.length + digitsCount)
        const num = parseInt(potentialNum, 10)
        if (!isNaN(num) && num > maxNum) maxNum = num
      }
    })

    const nextNum = maxNum + 1
    const nextNumStr = nextNum.toString().padStart(digitsCount, '0')

    return formatStr.replace(digitStr, nextNumStr)
  }

  const handleDeleteRun = async (id: string, isPaid: boolean) => {
    const msg = isPaid
      ? 'Hapus & Batalkan (Void) Gaji? Tindakan ini akan menghapus slip gaji dan mematikan jurnal akuntansi terkait.'
      : 'Yakin ingin menghapus draf penggajian ini?'

    if (!confirm(msg)) return

    setLoading(true)
    const res = isPaid ? await voidPayrollRun(id, orgId) : await deletePayrollRun(id, orgId)
    if (res.error) showToast(res.error, 'error')
    else {
      setPayrollRuns(payrollRuns.filter((r: any) => r.id !== id))
    }
    setLoading(false)
  }

  const refreshHrisPage = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const handleOpenTransfer = (emp: any) => {
    if (!transferTargets || transferTargets.length === 0) {
      showToast(transferDisabledReason || 'Belum ada entitas tujuan yang tersedia untuk mutasi.', 'info')
      return
    }

    const firstTarget = transferTargets[0]
    const firstBranch = firstTarget?.branches?.[0]

    setTransferingEmp(emp)
    setTransferTargetOrgId(firstTarget?.orgId || '')
    setTransferTargetBranchId(firstBranch?.id || '')
    setTransferAsTargetPic(false)
    setTransferNote('')
    setIsTransferModalOpen(true)
  }

  const handleChangeTransferTargetOrg = (nextOrgId: string) => {
    setTransferTargetOrgId(nextOrgId)
    const target = transferTargets.find((org: any) => org.orgId === nextOrgId)
    const firstBranchId = target?.branches?.[0]?.id || ''
    setTransferTargetBranchId(firstBranchId)
  }

  const handleSubmitTransfer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!transferingEmp) return
    if (!transferTargetOrgId || !transferTargetBranchId) {
      showToast('Pilih entitas dan unit tujuan terlebih dahulu.', 'error')
      return
    }

    setLoading(true)
    const res = await transferEmployeeToChildOrg(orgId, {
      employeeId: transferingEmp.id,
      targetOrgId: transferTargetOrgId,
      targetBranchId: transferTargetBranchId,
      assignPicToTargetBranch: transferAsTargetPic,
      note: transferNote,
    })

    if (res.error) {
      showToast(res.error, 'error')
      setLoading(false)
      return
    }

    setEmployees((current: any[]) => current.filter((row: any) => row.id !== transferingEmp.id))
    if (res.transferLog) {
      setTransferHistory((current: any[]) => [res.transferLog, ...current].slice(0, 20))
    }
    setIsTransferModalOpen(false)
    setTransferingEmp(null)
    showToast(res.warning ? `Mutasi selesai dengan catatan: ${res.warning}` : 'Mutasi karyawan berhasil diproses.', res.warning ? 'info' : 'success')
    refreshHrisPage()
    setLoading(false)
  }

  const handleSaveAttendance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const res = await upsertAttendanceRecord(orgId, new FormData(e.currentTarget))
    if (res.error) {
      showToast(res.error, 'error')
    } else {
      setIsAttendanceModalOpen(false)
      showToast('Absensi berhasil disimpan.', 'success')
      refreshHrisPage()
    }
    setLoading(false)
  }

  const handleCreateLeave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const res = await createLeaveRequest(orgId, new FormData(e.currentTarget))
    if (res.error) {
      showToast(res.error, 'error')
    } else {
      setIsLeaveModalOpen(false)
      showToast('Pengajuan cuti berhasil dibuat.', 'success')
      refreshHrisPage()
    }
    setLoading(false)
  }

  const handleProcessLeave = async (leaveId: string, action: 'approve' | 'reject') => {
    setLoading(true)
    const res = action === 'approve'
      ? await approveLeaveRequest(leaveId)
      : await rejectLeaveRequest(leaveId)

    if (res.error) {
      showToast(res.error, 'error')
    } else {
      showToast(
        action === 'approve' ? 'Pengajuan cuti disetujui.' : 'Pengajuan cuti ditolak.',
        'success'
      )
      refreshHrisPage()
    }
    setLoading(false)
  }

  const employeeScopeLabel = activeBranchName
    ? `Unit aktif: ${activeBranchName}`
    : allowAllBranchSelection
      ? 'Mode semua unit aktif'
      : 'Unit aktif belum dipilih'
  const attendanceScopeLabel = activeBranchName
    ? `Absensi & cuti untuk unit ${activeBranchName}`
    : allowAllBranchSelection
      ? 'Mode semua unit aktif'
      : 'Unit aktif belum dipilih'
  const payrollScopeLabel = activeBranchName
    ? `Payroll run untuk unit ${activeBranchName}`
    : allowAllBranchSelection
      ? 'Mode semua unit aktif'
      : 'Unit aktif belum dipilih'

  const hrisSubtitle =
    activeTab === 'ATTENDANCE'
      ? `Kontrol absensi harian dan pengajuan cuti dengan scope ${attendanceScopeLabel.toLowerCase()}.`
      : activeTab === 'PAYROLL'
        ? 'Atur template gaji, tunjangan, dan potongan karyawan. Komponen gaji tetap org-wide, tetapi payroll run sudah terscope per unit.'
        : activeTab === 'RUNS'
          ? `Lakukan generate slip gaji otomatis dan pencatatan kas jurnal dengan scope ${payrollScopeLabel.toLowerCase()}.`
          : `Manajemen sumber daya manusia dengan scope ${employeeScopeLabel.toLowerCase()}.`

  const todayAttendanceKey = new Date().toISOString().split('T')[0]
  const attendanceToday = attendanceRecords.filter((record: any) => record.record_date === todayAttendanceKey)
  const attendancePresentCount = attendanceToday.filter((record: any) => ['PRESENT', 'LATE', 'HALFDAY'].includes(String(record.status || '').toUpperCase())).length
  const attendanceCheckedOutCount = attendanceToday.filter((record: any) => Boolean(record.check_out)).length
  const attendanceLateCount = attendanceToday.filter((record: any) => String(record.status || '').toUpperCase() === 'LATE').length
  const pendingLeaveCount = leaveRequests.filter((request: any) => String(request.status || '').toUpperCase() === 'PENDING').length
  const defaultDateInput = new Date().toISOString().split('T')[0]
  const defaultDateTimeInput = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const selectedTransferOrg = transferTargets.find((org: any) => org.orgId === transferTargetOrgId)
  const selectedTransferBranches = selectedTransferOrg?.branches || []
  const showHrisImpersonationTools = Boolean(adminImpersonation)

  return (
    <div className="space-y-10 pb-20">
      <PageHeader
        title={
          activeTab === 'ATTENDANCE' ? 'Absensi & Cuti' :
          activeTab === 'PAYROLL' ? 'Payroll Components' :
          activeTab === 'RUNS' ? 'Proses Penggajian' :
          'HRIS Dashboard'
        }
        subtitle={
          hrisSubtitle
        }
        icon={
          activeTab === 'ATTENDANCE' ? <Clock /> :
          activeTab === 'PAYROLL' ? <FileText /> :
          activeTab === 'RUNS' ? <Wallet /> :
          <Users />
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 md:items-end">
            <div className="flex bg-slate-100 p-1.5 rounded-3xl border border-slate-200 shadow-inner overflow-x-auto scrollbar-hide max-w-[90vw] md:max-w-none">
              {['EMPLOYEES', 'POSITIONS', 'ACTIVATION'].includes(activeTab) && (
                <>
                  <button
                    onClick={() => setActiveTab('POSITIONS')}
                    className={`px-6 md:px-8 py-3 rounded-xl text-[10px] font-semibold tracking-tight transition-all shrink-0 ${activeTab === 'POSITIONS' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Positions & Roles
                  </button>
                  <button
                    onClick={() => setActiveTab('EMPLOYEES')}
                    className={`px-6 md:px-8 py-3 rounded-xl text-[10px] font-semibold tracking-tight transition-all shrink-0 ${activeTab === 'EMPLOYEES' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Employees
                  </button>
                  <button
                     onClick={() => setActiveTab('ACTIVATION')}
                     className={`px-6 md:px-8 py-3 rounded-xl text-[10px] font-semibold tracking-tight transition-all shrink-0 ${activeTab === 'ACTIVATION' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                     Activation Center
                  </button>
                </>
              )}
              {activeTab === 'ATTENDANCE' && (
                <button className="px-6 md:px-8 py-3 rounded-xl text-[10px] font-semibold tracking-tight transition-all shrink-0 bg-white text-blue-600 shadow-xl cursor-default">
                  Mesin Absensi Terpusat
                </button>
              )}
              {activeTab === 'PAYROLL' && (
                <button className="px-6 md:px-8 py-3 rounded-xl text-[10px] font-semibold tracking-tight transition-all shrink-0 bg-white text-blue-600 shadow-xl cursor-default">
                  Master Komponen Gaji
                </button>
              )}
              {activeTab === 'RUNS' && (
                <button className="px-6 md:px-8 py-3 rounded-xl text-[10px] font-semibold tracking-tight transition-all shrink-0 bg-white text-blue-600 shadow-xl cursor-default">
                  Siklus Penggajian
                </button>
              )}
            </div>
            {showHrisImpersonationTools && (
              <SafeButton
                onClick={() => setIsHrisImpersonationModalOpen(true)}
                variant="white"
                size="sm"
                icon={<ShieldCheck size={16} />}
              >
                HRIS IMPERSONATION
              </SafeButton>
            )}
          </div>
        }
      />

      {activeTab === 'EMPLOYEES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Workforce"
            value={employees.length.toString()}
            sub="Active Employees"
            icon={Users}
            color="blue"
          />
          <StatCard
            label="Open Roles"
            value={rolesList.length.toString()}
            sub="Current Openings"
            icon={Briefcase}
            color="indigo"
          />
          <StatCard
            label="This Month Payroll"
            value={formatRupiah(employees.reduce((sum: number, e: any) => sum + e.basic_salary, 0))}
            sub="Estimated Gross"
            icon={Banknote}
            color="emerald"
          />
          <StatCard
            label="Attendance Rate"
            value="98.2%"
            sub="Past 30 Days"
            icon={CheckCircle}
            color="amber"
          />
        </div>
      )}

      {activeTab === 'ATTENDANCE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Hadir Hari Ini"
            value={attendancePresentCount.toString()}
            sub="Termasuk telat & halfday"
            icon={CheckCircle}
            color="emerald"
          />
          <StatCard
            label="Sudah Check-Out"
            value={attendanceCheckedOutCount.toString()}
            sub="Dari catatan hari ini"
            icon={Clock}
            color="blue"
          />
          <StatCard
            label="Telat Hari Ini"
            value={attendanceLateCount.toString()}
            sub="Perlu review supervisor"
            icon={AlertTriangle}
            color="amber"
          />
          <StatCard
            label="Cuti Menunggu"
            value={pendingLeaveCount.toString()}
            sub="Pending approval"
            icon={CalendarDays}
            color="indigo"
          />
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'EMPLOYEES' && (
          <motion.div key="employees-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
            <SectionCard>
              <SectionHeader
                title="Active Personnel"
                icon={Users}
                actions={
                  <SafeButton onClick={handleOpenNew} variant="primary" size="sm" icon={<Plus size={16} />} disabled={!activeBranchId}>
                    ADD NEW EMPLOYEE
                  </SafeButton>
                }
              />

              <div className="p-2">
                <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Scope</div>
                  <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${activeBranchName ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {employeeScopeLabel}
                  </div>
                  {!activeBranchId && (
                    <div className="text-[11px] font-bold text-slate-500">
                      Pilih satu unit dari header jika ingin mendaftarkan karyawan baru.
                    </div>
                  )}
                  {transferTargets.length === 0 && transferDisabledReason && (
                    <div className="text-[11px] font-bold text-indigo-600">
                      Mutasi antar entitas nonaktif: {transferDisabledReason}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {employees.map((emp: any) => (
                    <motion.div
                      whileHover={{ y: -5 }}
                      key={emp.id}
                      className="bg-slate-50/50 p-8 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-white hover:shadow-2xl hover:shadow-blue-900/5 transition-all group flex flex-col gap-6"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center shadow-xl shadow-blue-100">
                            {emp.avatar_url ? (
                              <img src={emp.avatar_url} alt={emp.first_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-semibold text-white">
                                {emp.first_name[0]}{emp.last_name?.[0]}
                              </div>
                            )}
                          </div>
                            <div className="space-y-0.5">
                              <h4 className="font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight">{emp.first_name} {emp.last_name}</h4>
                              <div className="flex items-center gap-2">
                                <StatusBadge
                                  label={emp.employment_status.replace('_', ' ')}
                                  variant={
                                    ['RESIGNED', 'TERMINATED'].includes(String(emp.employment_status || '').toUpperCase())
                                      ? 'error'
                                      : emp.employment_status === 'FULL_TIME'
                                        ? 'success'
                                        : 'warning'
                                  }
                                />
                                <span className="text-[10px] font-semibold font-mono text-slate-400 tracking-tight">#{emp.nik}</span>
                                {emp.branch?.name && (
                                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-[0.18em] border border-blue-100">
                                    {emp.branch.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        <div className="flex flex-col gap-2 items-end">
                          <button
                            onClick={(e: any) => { e.stopPropagation(); handleOpenEdit(emp); }}
                            className="p-3 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition shadow-sm border border-slate-100"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e: any) => { e.stopPropagation(); handleOpenTransfer(emp); }}
                            disabled={transferTargets.length === 0}
                            className="p-3 bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition shadow-sm border border-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={transferTargets.length === 0 ? (transferDisabledReason || 'Belum ada entitas tujuan tersedia') : 'Mutasi ke entitas lain dalam holding'}
                          >
                            <ArrowRightLeft size={16} />
                          </button>
                          <button
                            onClick={(e: any) => { e.stopPropagation(); handleResignEmployee(emp); }}
                            disabled={String(emp.employment_status || '').toUpperCase() === 'RESIGNED'}
                            className="p-3 bg-white text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-2xl transition shadow-sm border border-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                              String(emp.employment_status || '').toUpperCase() === 'RESIGNED'
                                ? 'Karyawan sudah RESIGNED'
                                : 'Tandai sebagai RESIGNED'
                            }
                          >
                            <AlertCircle size={16} />
                          </button>
                          <button
                            onClick={(e: any) => { e.stopPropagation(); handleDeleteEmployee(emp); }}
                            className="p-3 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition shadow-sm border border-slate-100"
                            title="Hapus karyawan"
                          >
                            <Trash2 size={16} />
                          </button>
                          
                          {emp.reset_requested && (
                            <button
                              onClick={(e: any) => { e.stopPropagation(); handleResetPassword(emp); }}
                              disabled={resettingId === emp.id}
                              className="p-3 bg-rose-500 text-white hover:bg-rose-600 rounded-2xl transition shadow-lg shadow-rose-200 animate-bounce"
                              title="Karyawan minta reset password"
                            >
                              <Key size={16} className={resettingId === emp.id ? 'animate-spin' : ''} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-50 shadow-inner">
                          <span className="text-[9px] font-semibold text-slate-300 uppercase tracking-tight block mb-1">Position</span>
                          <p className="text-xs font-bold text-slate-600 truncate">{emp.job_title}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-50 shadow-inner">
                          <span className="text-[9px] font-semibold text-slate-300 uppercase tracking-tight block mb-1">Department</span>
                          <p className="text-xs font-bold text-slate-600 truncate">{emp.department || 'General'}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-100 text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold tracking-tight opacity-60">Base Salary</span>
                        </div>
                        <span className="text-sm font-black font-mono">{formatRupiah(emp.basic_salary)}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {employees.length === 0 && (
                  <EmptyState
                    title="No Employees Found"
                    description="Populate your human resources database by adding your first active personnel."
                    icon={Users}
                    action={
                      <SafeButton
                        onClick={handleOpenNew}
                        variant="primary"
                        size="sm"
                        icon={<Plus size={16} />}
                      >
                        Add First Employee
                      </SafeButton>
                    }
                  />
                )}

                {transferHistory.length > 0 && (
                  <div className="mt-10 rounded-xl border border-indigo-100 bg-indigo-50/50 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-white border border-indigo-100 text-indigo-600 flex items-center justify-center">
                        <ArrowRightLeft size={16} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.16em]">Riwayat Mutasi Antar Entitas</h4>
                        <p className="text-[11px] font-bold text-slate-500">20 aktivitas terbaru perpindahan karyawan antar entitas holding.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {transferHistory.map((item: any) => (
                        <div key={item.id} className="rounded-2xl border border-indigo-100 bg-white px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                            <span>{new Date(item.created_at).toLocaleString('id-ID')}</span>
                            <span>•</span>
                            <span>By {item.actor_email || '-'}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-800 mt-1">
                            {item.employee_name} <span className="text-slate-400 font-mono text-xs">#{item.employee_nik || '-'}</span>
                          </p>
                          <p className="text-xs font-semibold text-slate-500 mt-1">
                            {item.from_org_name} ({item.from_branch_name || '-'}) → {item.to_org_name} ({item.to_branch_name || '-'})
                          </p>
                          {item.target_assigned_as_pic && (
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 mt-1">Target branch ditetapkan sebagai PIC</p>
                          )}
                          {item.note && (
                            <p className="text-xs text-slate-500 mt-1 italic">Catatan: {item.note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          </motion.div>
        )}

        {activeTab === 'POSITIONS' && (
          <motion.div key="positions-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
            <SectionCard>
               <SectionHeader 
                  title="Organizational Structure (Roles)"
                  subtitle="Define job titles to assign to your workforce. Technical access control can be managed centrally in Settings > Access Control."
                  icon={Briefcase}
                  actions={
                    <SafeButton onClick={() => { setEditingPosition(null); setIsPositionModalOpen(true); }} variant="primary" size="sm" icon={<Plus size={16} />}>
                       ADD POSITION
                    </SafeButton>
                  }
               />
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
                  {rolesList.map((role: any) => (
                    <div key={role.id} className="bg-slate-50 border border-slate-100 p-6 rounded-xl group hover:border-blue-200 transition-all">
                       <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-blue-600">
                             <Briefcase size={20} />
                          </div>
                          {!role.is_system && (
                            <div className="flex gap-2">
                              <button onClick={() => { setEditingPosition(role); setIsPositionModalOpen(true); }} className="p-2 text-slate-300 hover:text-blue-600 bg-white rounded-xl shadow-sm"><Edit2 size={14}/></button>
                              <button onClick={() => handleDeletePosition(role.id, role.is_system)} className="p-2 text-slate-300 hover:text-rose-500 bg-white rounded-xl shadow-sm"><Trash2 size={14}/></button>
                            </div>
                          )}
                          {role.is_system && <StatusBadge label="SYSTEM PROTECTED" variant="warning" />}
                       </div>
                       <h4 className="font-black text-lg text-slate-900">{role.name}</h4>
                       
                       <div className="mt-4 pt-4 border-t border-slate-200/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <ShieldCheck size={14} className="text-emerald-500" />
                             <span className="text-[10px] font-bold text-slate-400 tracking-tight">{role.permissions?.length || 0} PERMISSIONS</span>
                          </div>
                          {role.priority !== undefined && (
                             <span className="text-[10px] font-black font-mono text-slate-300">P-{role.priority}</span>
                          )}
                       </div>
                    </div>
                  ))}
               </div>
            </SectionCard>
          </motion.div>
        )}

        {activeTab === 'ATTENDANCE' && (
          <motion.div key="attendance-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
            <SectionCard>
              <SectionHeader
                title="Attendance Register"
                subtitle="Kelola absensi manual per hari berdasarkan karyawan yang termasuk ke unit yang bisa Anda akses."
                icon={Clock}
                actions={
                  <SafeButton
                    onClick={() => setIsAttendanceModalOpen(true)}
                    variant="primary"
                    size="sm"
                    icon={<Plus size={16} />}
                    disabled={employees.length === 0}
                  >
                    CATAT ABSENSI
                  </SafeButton>
                }
              />

              <div className="p-2">
                <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Scope</div>
                  <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${activeBranchName ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {attendanceScopeLabel}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500">
                    {allowAllBranchSelection && !activeBranchId
                      ? 'Anda sedang melihat semua unit yang bisa diakses. Pilih karyawan untuk merekam absensi pada unitnya.'
                      : 'Catatan terbaru menampilkan 14 hari terakhir pada scope unit aktif.'}
                  </div>
                </div>

                <div className="space-y-4">
                  {attendanceRecords.map((record: any) => (
                    <div key={record.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-6 py-5 shadow-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900">
                              {record.employee?.first_name} {record.employee?.last_name}
                            </h4>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 border border-slate-100">
                              {record.employee?.nik || 'Tanpa NIK'}
                            </span>
                            {record.branch?.name && (
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-blue-600 border border-blue-100">
                                {record.branch.name}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500">
                            {record.employee?.job_title || 'Posisi belum diatur'} • {formatDate(record.record_date)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 md:justify-end">
                            <StatusBadge label={String(record.status || 'UNKNOWN').replace('_', ' ')} variant={
                              String(record.status || '').toUpperCase() === 'PRESENT'
                                ? 'success'
                                : String(record.status || '').toUpperCase() === 'LATE'
                                  ? 'warning'
                                  : String(record.status || '').toUpperCase() === 'ABSENT'
                                  ? 'error'
                                  : 'info'
                            } />
                          <div className="rounded-2xl bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 border border-slate-100">
                            IN {record.check_in ? new Date(record.check_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 border border-slate-100">
                            OUT {record.check_out ? new Date(record.check_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </div>
                        </div>
                      </div>
                      {record.notes && (
                        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-medium text-slate-500 border border-slate-100">
                          {record.notes}
                        </div>
                      )}
                    </div>
                  ))}

                  {attendanceRecords.length === 0 && (
                    <EmptyState
                      title="Belum ada catatan absensi"
                      description="Mulai isi absensi harian per unit agar HRIS punya log kehadiran yang konsisten."
                      icon={ClipboardList}
                      action={
                        <SafeButton
                          onClick={() => setIsAttendanceModalOpen(true)}
                          variant="primary"
                          size="sm"
                          icon={<Plus size={16} />}
                          disabled={employees.length === 0}
                        >
                          Catat Absensi Pertama
                        </SafeButton>
                      }
                    />
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <SectionHeader
                title="Leave Requests"
                subtitle="Kelola pengajuan cuti karyawan per unit. Approval sekarang sinkron ke HRIS dan Approval Center."
                icon={CalendarDays}
                actions={
                  <SafeButton
                    onClick={() => setIsLeaveModalOpen(true)}
                    variant="indigo"
                    size="sm"
                    icon={<Plus size={16} />}
                    disabled={employees.length === 0}
                  >
                    AJUKAN CUTI
                  </SafeButton>
                }
              />

              <div className="p-2">
                <div className="space-y-4">
                  {leaveRequests.map((request: any) => (
                    <div key={request.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-6 py-5 shadow-sm">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900">
                              {request.employee?.first_name} {request.employee?.last_name}
                            </h4>
                            <StatusBadge
                              label={String(request.status || 'PENDING').replace('_', ' ')}
                              variant={
                                String(request.status || '').toUpperCase() === 'APPROVED'
                                  ? 'success'
                                  : String(request.status || '').toUpperCase() === 'REJECTED'
                                    ? 'error'
                                    : 'warning'
                              }
                            />
                            {request.branch?.name && (
                              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-indigo-600 border border-indigo-100">
                                {request.branch.name}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500">
                            {request.leave_type} • {formatDate(request.start_date)} sampai {formatDate(request.end_date)} • {request.days_taken} hari
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3 text-xs font-medium text-slate-500 border border-slate-100">
                            {request.reason}
                          </div>
                        </div>

                        {String(request.status || '').toUpperCase() === 'PENDING' && (
                          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                            <SafeButton
                              onClick={() => handleProcessLeave(request.id, 'approve')}
                              variant="emerald"
                              size="sm"
                              icon={<Check size={14} />}
                              isLoading={loading}
                            >
                              APPROVE
                            </SafeButton>
                            <SafeButton
                              onClick={() => handleProcessLeave(request.id, 'reject')}
                              variant="danger"
                              size="sm"
                              icon={<X size={14} />}
                              isLoading={loading}
                            >
                              REJECT
                            </SafeButton>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {leaveRequests.length === 0 && (
                    <EmptyState
                      title="Belum ada pengajuan cuti"
                      description="Gunakan form pengajuan untuk mulai mencatat leave request per unit."
                      icon={CalendarDays}
                      action={
                        <SafeButton
                          onClick={() => setIsLeaveModalOpen(true)}
                          variant="indigo"
                          size="sm"
                          icon={<Plus size={16} />}
                          disabled={employees.length === 0}
                        >
                          Buat Pengajuan Cuti
                        </SafeButton>
                      }
                    />
                  )}
                </div>
              </div>
            </SectionCard>
          </motion.div>
        )}

        {activeTab === 'PAYROLL' && (
          <motion.div key="payroll-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
            <SectionCard>
              <SectionHeader
                title="Payroll Engine Configuration"
                subtitle="Define earnings, deductions, and tax rules with GL mapping."
                icon={Banknote}
                actions={
                  <SafeButton onClick={() => setIsPayrollModalOpen(true)} variant="primary" size="sm" icon={<Plus size={16} />}>
                    ADD COMPONENT
                  </SafeButton>
                }
              />

              <div className="p-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {(['EARNING', 'DEDUCTION', 'TAX', 'BENEFIT'] as const).map(type => {
                    const mapped = payrollComponents.filter((p: any) => p.type === type)
                    if (mapped.length === 0) return null

                    const config = {
                      EARNING: { title: 'Earnings & Allowances', variant: 'success', icon: TrendingUp },
                      DEDUCTION: { title: 'Employee Deductions', variant: 'danger', icon: Wallet },
                      TAX: { title: 'Taxation Rules (PPh 21)', variant: 'warning', icon: ShieldCheck },
                      BENEFIT: { title: 'Company Benefits', variant: 'info', icon: Briefcase }
                    } as const

                    const { title, variant, icon: Icon } = config[type]

                    return (
                      <div key={type} className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden flex flex-col">
                        <div className="px-8 py-5 flex items-center justify-between border-b border-white">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center 
                                   ${variant === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                variant === 'danger' ? 'bg-rose-100 text-rose-600' :
                                  variant === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                              <Icon size={16} />
                            </div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h4>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          {mapped.map((comp: any) => (
                            <div key={comp.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-between group hover:border-blue-200 transition-all">
                              <div className="space-y-2">
                                <h5 className="font-black text-slate-800 tracking-tight">{comp.name}</h5>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-black font-mono rounded-lg border border-slate-100">
                                    {comp.is_percentage ? `${comp.percentage_value}% of Base` : formatRupiah(comp.default_amount)}
                                  </span>
                                  <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border flex items-center gap-1.5
                                         ${comp.account ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                    <LinkIcon size={10} /> {comp.account ? `${comp.account.code}` : 'NO MAPPING'}
                                  </span>
                                  {comp.is_taxable && <StatusBadge label="TAXABLE" variant="warning" />}
                                </div>
                              </div>
                              <button onClick={() => handleDeletePayrollComponent(comp.id)} className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {payrollComponents.length === 0 && (
                  <EmptyState
                    title="No Components Defined"
                    description="Set up your salary structure by adding allowances, deductions, and tax mapping."
                    icon={Banknote}
                    action={
                      <SafeButton onClick={() => setIsPayrollModalOpen(true)} variant="primary" size="sm" icon={<Plus size={16} />}>
                        Add First Component
                      </SafeButton>
                    }
                  />
                )}
              </div>
            </SectionCard>
          </motion.div>
        )}

        {activeTab === 'RUNS' && (
          <motion.div key="runs-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
            <SectionCard>
              <SectionHeader
                title="Payroll Run History"
                subtitle="Review, approve, and execute disbursements."
                icon={CalendarDays}
                actions={
                  <div className="flex gap-3">
                    <SafeButton
                      onClick={async () => {
                        setLoading(true)
                        const res = await fixEmptyPayrollJournals(orgId)
                        setLoading(false)
                        if (res.success) showToast(`Success: Fixed ${res.count} journals!`, 'success')
                      }}
                      variant="secondary"
                      size="sm"
                      icon={<Check size={16} />}
                      isLoading={loading}
                      disabled={!activeBranchId}
                    >
                      FIX JOURNALS
                    </SafeButton>
                    <SafeButton onClick={() => setIsRunModalOpen(true)} variant="primary" size="sm" icon={<Plus size={16} />} disabled={!activeBranchId}>
                      GENERATE RUN
                    </SafeButton>
                  </div>
                }
              />

              <div className="overflow-x-auto min-h-[400px]">
                <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Scope</div>
                  <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${activeBranchName ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {payrollScopeLabel}
                  </div>
                  {!activeBranchId && (
                    <div className="text-[11px] font-bold text-slate-500">
                      Pilih satu unit dari header jika ingin membuat atau memperbaiki payroll run.
                    </div>
                  )}
                </div>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Period</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Gross Total</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Deductions</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right whitespace-nowrap">Net Payable</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payrollRuns.map((run: any) => (
                      <tr key={run.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="font-black text-slate-900 tracking-tight uppercase">{new Date(run.period_start).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</div>
                          <div className="text-[10px] text-slate-400 font-bold font-mono mt-1 tracking-wider italic flex items-center gap-2">
                            <Clock size={10} /> {run.period_start} - {run.period_end}
                          </div>
                          {run.branch?.name && (
                            <div className="mt-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-blue-600 border border-blue-100">
                              {run.branch.name}
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="text-xs font-bold text-slate-500 font-mono">{formatRupiah(run.total_gross)}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="text-xs font-bold text-rose-400 font-mono">-{formatRupiah(run.total_deductions)}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="bg-blue-50 px-4 py-2 rounded-xl inline-block border border-blue-100 shadow-inner">
                            <span className="text-sm font-black text-blue-600 font-mono italic">{formatRupiah(run.total_net)}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <StatusBadge label={run.status} variant={run.status === 'PAID' ? 'success' : 'warning'} />
                          {run.payment_date && <div className="text-[9px] text-slate-300 font-semibold mt-1 uppercase tracking-tight">{run.payment_date}</div>}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={async () => {
                                const res = await getPayrollRunDetails(orgId, run.id)
                                setViewingRun(run)
                                setViewingRunData(res)
                              }}
                              className="w-10 h-10 flex items-center justify-center bg-white text-slate-400 rounded-xl hover:text-blue-600 hover:shadow-lg transition-all border border-slate-100"
                            >
                              <Eye size={18} />
                            </button>

                            {run.status === 'DRAFT' ? (
                              <>
                                <SafeButton
                                  onClick={() => setIsPayModalOpen(run)}
                                  variant="emerald"
                                  size="sm"
                                >
                                  DISBURSE
                                </SafeButton>
                                <button onClick={() => handleDeleteRun(run.id, false)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => handleDeleteRun(run.id, true)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors" title="Void Payroll">
                                <AlertCircle size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {payrollRuns.length === 0 && (
                  <div className="py-20">
                    <EmptyState
                      title="No Payroll Records"
                      description="Start your first payroll calculation for this organization."
                      icon={CalendarDays}
                      action={
                        <SafeButton onClick={() => setIsRunModalOpen(true)} variant="primary" size="sm" icon={<Plus size={16} />} disabled={!activeBranchId}>
                          Create First Run
                        </SafeButton>
                      }
                    />
                  </div>
                )}
              </div>
            </SectionCard>
          </motion.div>
        )}

        {/* ACTIVATION CENTER TAB */}
        {activeTab === 'ACTIVATION' && (
          <motion.div key="activation-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
            <SectionCard>
               <SectionHeader 
                  title="Pusat Aktivasi Karyawan"
                  subtitle="Gunakan link token unik di bawah untuk mengundang karyawan baru."
                  icon={Key}
                  actions={
                    <SafeButton onClick={() => setIsInviteModalOpen(true)} variant="primary" size="sm" icon={<Plus size={16} />}>
                       BUAT LINK BARU
                    </SafeButton>
                  }
               />
               
               <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-slate-900 text-white">
                           <th className="px-8 py-5 text-[10px] font-semibold tracking-tight">Label Undangan</th>
                           <th className="px-8 py-5 text-[10px] font-semibold tracking-tight">Role & Masa Berlaku</th>
                           <th className="px-8 py-5 text-[10px] font-semibold tracking-tight text-center">Token</th>
                           <th className="px-8 py-5 text-[10px] font-semibold tracking-tight text-right">Aksi</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {invitations.length === 0 ? (
                           <tr>
                              <td colSpan={4} className="px-8 py-12 text-center text-slate-400 italic font-medium">Belum ada link aktivasi yang dibuat. Klik tombol di atas untuk membuat.</td>
                           </tr>
                        ) : invitations.map((inv: any) => (
                           <tr key={inv.id} className="hover:bg-slate-50 transition-all group">
                              <td className="px-8 py-6">
                                 <div className="font-black text-slate-900 text-[13px] tracking-tight">{inv.label}</div>
                                 <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Dibuat: {new Date(inv.created_at).toLocaleDateString()}</div>
                              </td>
                              <td className="px-8 py-6">
                                 <div className="flex flex-col gap-2">
                                    <div className="px-4 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg inline-flex items-center gap-2 border border-slate-200 w-fit">
                                       <ShieldCheck size={12} className="text-slate-400" /> {inv.roles?.name || 'Staff Umum'}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 ml-1">
                                       <Clock size={10} /> Expired: {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '∞ Unlimited'}
                                    </div>
                                 </div>
                              </td>
                              <td className="px-8 py-6 text-center">
                                 <code className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-sm border-2 border-blue-100 border-dashed">{inv.invitation_code}</code>
                              </td>
                              <td className="px-8 py-6">
                                 <div className="flex items-center justify-end gap-3 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                         const url = `${baseUrl}/join/${inv.invitation_code}`;
                                         navigator.clipboard.writeText(url);
                                         showToast('Link pendaftaran berhasil disalin!', 'success');
                                      }}
                                      className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                    >
                                       <LinkIcon size={16} />
                                    </button>
                                    <button 
                                      type="button" 
                                      onClick={() => handleDeleteInvite(inv.id)}
                                      className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                    >
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </SectionCard>
          </motion.div>
         )}
      </AnimatePresence>

      <AnimatePresence>
        {isHrisImpersonationModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHrisImpersonationModalOpen(false)}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-white"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-emerald-50/70">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-100">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 tracking-tight uppercase italic">HRIS Impersonation</h3>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-0.5">
                      Aktif karena admin platform sedang impersonate tenant {adminImpersonation?.email ? `• ${adminImpersonation.email}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHrisImpersonationModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-6 py-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Kapan panel ini muncul?</div>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed">
                    Panel ini hanya tampil saat platform admin sedang berada dalam mode impersonation tenant. Dari sini Anda bisa turun ke akun yang punya akses HR/HRIS untuk cek scope menu, branch, dan batas akses aslinya.
                  </p>
                </div>

                {hrisImpersonationTargets.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-6 py-8 text-center">
                    <p className="text-sm font-black text-slate-700">Belum ada akun HR/HRIS yang siap dipakai.</p>
                    <p className="text-xs font-semibold text-slate-500 mt-2">
                      Pastikan tenant punya user aktif dengan role HR, admin, owner, atau custom role yang memiliki permission HRIS.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {hrisImpersonationTargets.map((candidate: HrisImpersonationTarget) => {
                      const targetUserId = String(candidate?.targetUserId || '').trim()
                      const rawUserId = String(candidate?.rawUserId || '').trim()
                      const isCurrentTarget = Boolean(candidate?.isCurrentUser) || rawUserId === currentUserId || targetUserId === currentUserId
                      return (
                        <div
                          key={targetUserId || candidate?.rawUserId}
                          className={`rounded-xl border p-6 transition-all ${isCurrentTarget ? 'border-emerald-300 bg-emerald-50/70 shadow-lg shadow-emerald-100/60' : 'border-slate-100 bg-slate-50/70 hover:border-emerald-200 hover:bg-white'}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-black text-slate-900 truncate">{candidate.displayName || 'User Tenant'}</h4>
                                <StatusBadge
                                  label={isCurrentTarget ? 'SEDANG AKTIF' : String(candidate.roleLabel || 'HRIS').toUpperCase()}
                                  variant={isCurrentTarget ? 'success' : 'warning'}
                                />
                              </div>
                              <div className="space-y-1 text-xs font-semibold text-slate-500">
                                <p>Email login: {candidate.email || '-'}</p>
                                <p>NIK: {candidate.nik || '-'}</p>
                                <p>Unit default: {candidate.branchName || 'Tidak terikat unit tertentu'}</p>
                              </div>
                            </div>
                            <SafeButton
                              onClick={() => handleImpersonateHrisUser(candidate)}
                              variant={isCurrentTarget ? 'ghost' : 'emerald'}
                              size="sm"
                              icon={<ArrowUpRight size={14} />}
                              isLoading={impersonatingTargetUserId === targetUserId}
                              disabled={isCurrentTarget}
                            >
                              {isCurrentTarget ? 'AKUN AKTIF' : 'MASUK SEBAGAI'}
                            </SafeButton>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACTIVATION MODAL */}
        <AnimatePresence>
          {isInviteModalOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div key="invite-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInviteModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
                <motion.div key="invite-modal-content" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-white">
                    <div className="p-10 space-y-8">
                      <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
                            <LinkIcon size={28} />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-slate-900 leading-none">BUAT LINK AKTIVASI</h3>
                            <p className="text-[10px] font-bold text-slate-400 tracking-tight mt-1">Token-based invitation system</p>
                          </div>
                      </div>

                      <form onSubmit={handleCreateInvite} className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Label / Nama Link</label>
                            <input name="label" required placeholder="Cth: Rekrutmen Staff Gudang" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Role Otomatis</label>
                                <select name="role_id" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all">
                                  <option value="">-- Staff Umum --</option>
                                  {rolesList.map((r: any) => (
                                      <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>
                                  ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Masa Berlaku</label>
                                <select name="duration" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all">
                                  <option value="0">∞ Selamanya</option>
                                  <option value="1">1 Hari</option>
                                  <option value="7">7 Hari</option>
                                  <option value="30">30 Hari</option>
                                </select>
                            </div>
                          </div>
                          
                          <div className="flex gap-4 pt-4 border-t border-slate-100">
                            <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-tight hover:bg-slate-50 rounded-2xl transition-all">Batal</button>
                            <button type="submit" disabled={loading} className="flex-1 py-4 bg-blue-600 text-white text-[11px] font-semibold tracking-tight rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">
                                {loading ? "Menyimpan..." : "Buat Link"}
                            </button>
                          </div>
                      </form>
                    </div>
                </motion.div>
              </div>
          )}
        </AnimatePresence>
        {/* POSITION MODAL */}
        <AnimatePresence>
          {isPositionModalOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPositionModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-white">
                    <div className="p-10 space-y-8">
                      <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                            <Briefcase size={28} />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-slate-900 leading-none">{editingPosition ? 'EDIT POSISI' : 'BUAT POSISI BARU'}</h3>
                            <p className="text-[10px] font-bold text-slate-400 tracking-tight mt-1">Struktur Organisasi NIZAM</p>
                          </div>
                      </div>

                      <form onSubmit={handleSavePosition} className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Nama Jabatan</label>
                            <input name="name" defaultValue={editingPosition?.name} required placeholder="Cth: Kepala Mekanik / Sales" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all" />
                          </div>
                          
                          <div className="flex gap-4 pt-4 border-t border-slate-100">
                            <button type="button" onClick={() => setIsPositionModalOpen(false)} className="flex-1 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-tight hover:bg-slate-50 rounded-2xl transition-all">Batal</button>
                            <button type="submit" disabled={loading} className="flex-1 py-4 bg-indigo-600 text-white text-[11px] font-semibold tracking-tight rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                                {loading ? "Menyimpan..." : "Simpan Posisi"}
                            </button>
                          </div>
                      </form>
                    </div>
                </motion.div>
              </div>
          )}
        </AnimatePresence>

      {/* Add Payroll Component Modal */}
      <AnimatePresence>
        {isPayrollModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPayrollModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-white">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Banknote size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 tracking-tight uppercase italic">Payroll Component</h3>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-0.5">Configuration & GL Mapping</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsPayrollModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="p-8">
                <form id="payroll-form" onSubmit={handleCreatePayrollComponent} className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Component Template</label>
                    <select
                      value={componentNameOption} onChange={(e: any) => handleComponentSelect(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner"
                    >
                      <option value="Tunjangan Makan">Tunjangan Makan (Pendapatan)</option>
                      <option value="Tunjangan Transport">Tunjangan Transport (Pendapatan)</option>
                      <option value="BPJS Kesehatan (Karyawan)">BPJS Kesehatan (Potongan Karyawan 1%)</option>
                      <option value="BPJS Ketenagakerjaan JHT (Karyawan)">BPJS Ketenagakerjaan JHT (Potongan Karyawan 2%)</option>
                      <option value="PPh 21">Tarif Pajak PPh 21 (Deduction)</option>
                      <option value="Potongan Koperasi">Potongan Koperasi / Kasbon</option>
                      <option value="CUSTOM">Lainnya (Tulis Kustom...)</option>
                    </select>

                    {componentNameOption === 'CUSTOM' && (
                      <input
                        name="name"
                        value={customComponentName} onChange={(e: any) => setCustomComponentName(e.target.value)}
                        required
                        placeholder="Enter component name..."
                        className="w-full mt-3 px-6 py-4 bg-white border-2 border-blue-50 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-all shadow-sm"
                      />
                    )}
                    {componentNameOption !== 'CUSTOM' && (
                      <input type="hidden" name="name" value={componentNameOption} />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Cash Flow Category</label>
                    <select name="type" required value={componentType} onChange={(e: any) => setComponentType(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner">
                      <option value="EARNING">Earnings (Allowances / Bonuses)</option>
                      <option value="DEDUCTION">Deductions (Employee Pays)</option>
                      <option value="TAX">Tax Deduction (PPh 21 Specific)</option>
                      <option value="BENEFIT">Company Benefits (Non-Slip)</option>
                    </select>
                  </div>

                  <div className="p-6 rounded-xl border border-blue-100 bg-blue-50/30 space-y-6">
                    <label
                      htmlFor="is_percentage"
                      className="flex items-center gap-4 cursor-pointer select-none w-fit"
                    >
                      <span className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          id="is_percentage"
                          name="is_percentage"
                          checked={isPercentage}
                          onChange={(e: any) => setIsPercentage(e.target.checked)}
                          className="sr-only peer"
                        />
                        <span className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></span>
                      </span>
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">
                        Calculate by Percentage (%)
                      </span>
                    </label>
                    {!isPercentage ? (
                      <CurrencyInput
                        label="Default Nominal (Rp)"
                        value={payrollAmount}
                        onChange={setPayrollAmount}
                      />
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="flex-1 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Percentage Rate (%)</label>
                          <div className="relative">
                            <input type="number" step="0.01" value={payrollAmount} onChange={(e: any) => setPayrollAmount(Number(e.target.value))} required placeholder="2.00" className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-black text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm" />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">%</span>
                          </div>
                        </div>
                        <div className="pt-8 text-[10px] font-bold text-slate-400 italic">of Basic Salary</div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                      General Ledger Mapping
                    </label>
                    <select name="account_id" required className="w-full px-6 py-4 bg-white border-2 border-indigo-50 shadow-[0_10px_20px_-5px_rgba(99,102,241,0.1)] rounded-2xl text-sm font-black text-indigo-700 outline-none focus:border-indigo-500 transition-all">
                      <option value="">-- UNMAPPED (REQUIRED) --</option>
                      {accounts.map((acc: any) => (
                        <option key={acc.account_id} value={acc.account_id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-4 pt-4 bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" id="is_taxable" name="is_taxable" checked={isTaxable} onChange={(e: any) => setIsTaxable(e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      <label htmlFor="is_taxable" className="ml-3 text-[11px] font-black text-slate-800 uppercase tracking-tight cursor-pointer">Taxable Component (PPh 21 Effect)</label>
                    </div>
                  </div>
                </form>
              </div>

              <div className="px-8 py-6 border-t border-slate-50 bg-slate-50/30 flex justify-end gap-4">
                <button type="button" onClick={() => setIsPayrollModalOpen(false)} className="px-8 py-3 rounded-2xl text-[11px] font-semibold uppercase text-slate-400 hover:bg-slate-100 transition-all tracking-tight">CANCEL</button>
                <SafeButton
                  form="payroll-form"
                  type="submit"
                  variant="primary"
                  size="lg"
                  icon={<Check size={18} />}
                  isLoading={loading}
                >
                  CREATE COMPONENT
                </SafeButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAttendanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAttendanceModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-white">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 tracking-tight uppercase italic">Attendance Register</h3>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-0.5">Catat kehadiran berdasarkan unit karyawan</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsAttendanceModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveAttendance} className="p-10 space-y-8">
                <div className="rounded-xl border px-6 py-5 border-blue-100 bg-blue-50/60">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Konteks Unit</div>
                  <div className="text-sm font-black text-slate-800">
                    {activeBranchName
                      ? `Anda sedang bekerja di unit ${activeBranchName}.`
                      : allowAllBranchSelection
                        ? 'Mode semua unit aktif. Unit akan mengikuti branch karyawan yang dipilih.'
                        : 'Unit aktif belum dipilih.'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Karyawan</label>
                  <select name="employee_id" required className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all">
                    <option value="">-- PILIH KARYAWAN --</option>
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} {emp.branch?.name ? `• ${emp.branch.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tanggal</label>
                    <input name="record_date" type="date" required defaultValue={defaultDateInput} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Status</label>
                    <select name="status" defaultValue="PRESENT" className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all">
                      <option value="PRESENT">PRESENT</option>
                      <option value="LATE">LATE</option>
                      <option value="HALFDAY">HALFDAY</option>
                      <option value="SICK">SICK</option>
                      <option value="LEAVE">LEAVE</option>
                      <option value="ABSENT">ABSENT</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Jam Masuk</label>
                    <input name="check_in" type="datetime-local" defaultValue={defaultDateTimeInput} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Jam Keluar</label>
                    <input name="check_out" type="datetime-local" className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Catatan</label>
                  <textarea name="notes" rows={4} placeholder="Catatan keterlambatan, izin, atau keterangan lain..." className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all resize-none" />
                </div>

                <div className="flex items-center justify-end gap-4">
                  <button type="button" onClick={() => setIsAttendanceModalOpen(false)} className="px-8 py-3 rounded-2xl text-[11px] font-semibold uppercase text-slate-400 hover:bg-slate-100 transition-all tracking-tight">CANCEL</button>
                  <SafeButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    icon={<Check size={18} />}
                    isLoading={loading}
                  >
                    SIMPAN ABSENSI
                  </SafeButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLeaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsLeaveModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-white">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100">
                    <CalendarDays size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 tracking-tight uppercase italic">Leave Request</h3>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-0.5">Ajukan cuti sesuai unit karyawan</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsLeaveModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateLeave} className="p-10 space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Karyawan</label>
                  <select name="employee_id" required className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all">
                    <option value="">-- PILIH KARYAWAN --</option>
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} {emp.branch?.name ? `• ${emp.branch.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Jenis Cuti</label>
                    <select name="leave_type" required defaultValue="Annual Leave" className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all">
                      <option value="Annual Leave">Annual Leave</option>
                      <option value="Sick Leave">Sick Leave</option>
                      <option value="Unpaid Leave">Unpaid Leave</option>
                      <option value="Special Leave">Special Leave</option>
                    </select>
                  </div>
                  <div className="rounded-xl border px-6 py-5 border-indigo-100 bg-indigo-50/60">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Scope</div>
                    <div className="text-sm font-black text-slate-800">{attendanceScopeLabel}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tanggal Mulai</label>
                    <input name="start_date" type="date" required defaultValue={defaultDateInput} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tanggal Selesai</label>
                    <input name="end_date" type="date" required defaultValue={defaultDateInput} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Alasan</label>
                  <textarea name="reason" rows={4} required placeholder="Tuliskan alasan cuti..." className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all resize-none" />
                </div>

                <div className="flex items-center justify-end gap-4">
                  <button type="button" onClick={() => setIsLeaveModalOpen(false)} className="px-8 py-3 rounded-2xl text-[11px] font-semibold uppercase text-slate-400 hover:bg-slate-100 transition-all tracking-tight">CANCEL</button>
                  <SafeButton
                    type="submit"
                    variant="indigo"
                    size="lg"
                    icon={<Check size={18} />}
                    isLoading={loading}
                  >
                    KIRIM PENGAJUAN
                  </SafeButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRunModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRunModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-white">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-blue-600 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <CalendarDays size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight uppercase italic">Generate Payroll</h3>
                    <p className="text-[10px] font-semibold opacity-70 uppercase tracking-tight mt-0.5">Bulk salary calculation</p>
                  </div>
                </div>
                <button onClick={() => setIsRunModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
                e.preventDefault()
                setLoading(true)
                const res = await generatePayrollRun(orgId, new FormData(e.currentTarget))
                if (res.error) showToast(res.error, 'error')
                else window.location.reload()
              }} className="p-10 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Period Start</label>
                    <input name="period_start" type="date" required className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 transition-all outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Period End</label>
                    <input name="period_end" type="date" required className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 transition-all outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Disbursement Date</label>
                  <input name="payment_date" type="date" required className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 transition-all outline-none" />
                </div>
                <div className="p-6 bg-blue-50/50 rounded-xl border border-blue-100/50">
                  <p className="text-[11px] text-blue-600 font-bold leading-relaxed text-center italic">
                    {activeBranchName
                      ? `Payroll hanya akan dibuat untuk karyawan di unit ${activeBranchName}.`
                      : 'Pilih unit aktif terlebih dahulu untuk membuat payroll run.'}
                  </p>
                </div>
                <SafeButton
                  type="submit"
                  variant="primary"
                  size="xl"
                  isLoading={loading}
                  icon={<CalendarDays size={20} />}
                  className="w-full rounded-xl"
                  disabled={!activeBranchId}
                >
                  GENERATE PAYROLL RUN
                </SafeButton>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {resetModalEmp && (
          <div key="reset-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResetModalEmp(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-white">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Key size={24} />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-black text-slate-900 tracking-tight uppercase italic">{resetModalEmp.first_name}</h3>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-0.5">Force Reset Password</p>
                  </div>
                </div>
                <button type="button" onClick={() => setResetModalEmp(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">New Password</label>
                  <input 
                    type="text" 
                    value={resetModalPwd}
                    onChange={(e) => setResetModalPwd(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-amber-500 transition-all" 
                  />
                  <p className="text-[10px] text-amber-600 font-bold px-1 py-1 italic">
                    Karyawan harus mengganti password ini setelah berhasil login.
                  </p>
                </div>
                
                <div className="space-y-3 pt-2">
                  <SafeButton
                    onClick={() => submitPasswordReset(true)}
                    variant="primary"
                    size="xl"
                    isLoading={resettingId === resetModalEmp.id}
                    icon={<MessageCircle size={20} />}
                    className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
                  >
                    RESET & KIRIM WHATSAPP
                  </SafeButton>
                  
                  <button
                    type="button"
                    onClick={() => submitPasswordReset(false)}
                    disabled={resettingId === resetModalEmp.id}
                    className="w-full py-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 font-bold tracking-widest uppercase text-[11px] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    RESET SAJA (TANPA WA)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPayModalOpen && (
          <div key="pay-modal" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPayModalOpen(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-white">
              <div className="p-10 text-center space-y-8">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mx-auto shadow-inner">
                  <Banknote size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-semibold text-slate-900 tracking-tighter uppercase italic">Disburse Funds</h3>
                  <p className="text-sm text-slate-500 font-medium">You are about to release <span className="text-emerald-600 font-black">{formatRupiah(isPayModalOpen.total_net)}</span> to employees.</p>
                </div>

                <div className="space-y-2 text-left bg-slate-50/50 p-8 rounded-xl border border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Funding Account (Bank/Cash)</label>
                  <select id="pay-account" className="w-full px-6 py-4 rounded-2xl border border-slate-200 font-black text-slate-800 outline-none focus:border-emerald-500 transition-all bg-white shadow-sm appearance-none">
                    <option value="">-- SELECT SOURCE ACCOUNT --</option>
                    {accounts.filter((a: any) => a.code.startsWith('11')).map((acc: any) => (
                      <option key={acc.account_id} value={acc.account_id}>{acc.code} - {acc.name} ({formatRupiah(acc.balance)})</option>
                    ))}
                  </select>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mt-4">
                    <p className="text-[9px] text-amber-700 leading-relaxed font-semibold tracking-tight text-center">Auto-Journaling: This will create a Bank Credit & Salary Expense entry.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <SafeButton
                    onClick={async () => {
                      const accId = (document.getElementById('pay-account') as HTMLSelectElement).value
                      if (!accId) return showToast('Please select a source account.', 'error')
                      setLoading(true)
                      const res = await payPayrollRun(isPayModalOpen.id, orgId, accId)
                      if (res.error) showToast(res.error, 'error')
                      else window.location.reload()
                    }}
                    isLoading={loading}
                    variant="emerald"
                    size="xl"
                    icon={<ShieldCheck size={20} />}
                    className="w-full rounded-xl"
                  >
                    CONFIRM & DISBURSE
                  </SafeButton>
                  <button onClick={() => setIsPayModalOpen(null)} className="text-[10px] font-semibold tracking-tight text-slate-300 hover:text-slate-500 transition-all">ABORT OPERATION</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddModalOpen && (
          <div key="add-emp-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-white flex flex-col max-h-[90vh]"
            >
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 tracking-tight uppercase italic">{editingEmp ? 'Profile Revision' : 'Employee Registration'}</h3>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-0.5">{editingEmp ? 'Update personnel records' : 'Fill legal master data'}</p>
                  </div>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="p-10 overflow-y-auto no-scrollbar flex-1">
                <form id="emp-form" onSubmit={handleCreateEmp} className="space-y-12">
                  <div className={`rounded-xl border px-6 py-5 ${editingEmp ? 'border-blue-100 bg-blue-50/60' : activeBranchId ? 'border-emerald-100 bg-emerald-50/60' : 'border-amber-100 bg-amber-50/60'}`}>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                      Konteks Unit
                    </div>
                    <div className="text-sm font-black text-slate-800">
                      {editingEmp?.branch?.name
                        ? `Profil ini terdaftar di unit ${editingEmp.branch.name}.`
                        : activeBranchName
                          ? `Karyawan baru akan didaftarkan ke unit ${activeBranchName}.`
                          : 'Pilih unit aktif dari header sebelum menambahkan karyawan baru.'}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-1 bg-blue-600 rounded-full" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personal Identity</h4>
                    </div>

                    {/* Avatar upload */}
                    <div className="flex items-center gap-6">
                      <button type="button" onClick={() => avatarInputRef.current?.click()} className="relative group shrink-0">
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                          {avatarPreview ? (
                            <img src={avatarPreview} className="w-full h-full object-cover" alt="avatar" />
                          ) : (
                            <span className="text-2xl font-semibold text-white">{(editingEmp?.first_name || 'K')[0]}</span>
                          )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <Users size={20} className="text-white" />
                        </div>
                      </button>
                      <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                      <div>
                        <p className="text-sm font-black text-slate-700">Foto Karyawan</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Klik untuk upload gambar (JPG, PNG)</p>
                        {avatarPreview && (
                          <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null) }} className="text-[10px] text-rose-500 font-bold mt-1 hover:underline">Hapus Foto</button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">NIK / ID</label>
                        <input name="nik" placeholder="K-0001" required defaultValue={editingEmp?.nik || getNextNik()} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Join Date</label>
                        <input name="join_date" type="date" required defaultValue={editingEmp?.join_date || new Date().toISOString().split('T')[0]} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <input name="first_name" placeholder="First Name *" required defaultValue={editingEmp?.first_name || ''} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none" />
                      <input name="last_name" placeholder="Last Name" defaultValue={editingEmp?.last_name || ''} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <input name="email" type="email" placeholder="Email Address" defaultValue={editingEmp?.email || ''} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none" />
                      <select name="gender" defaultValue={editingEmp?.gender || ''} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none">
                        <option value="">GENDER</option>
                        <option value="M">MALE</option>
                        <option value="F">FEMALE</option>
                      </select>
                    </div>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-sm">📱</span>
                      <input name="whatsapp" type="tel" placeholder="Nomor WhatsApp (cth: 628123456789)" defaultValue={editingEmp?.whatsapp || ''} className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-emerald-500 outline-none transition-all" />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-1 bg-indigo-600 rounded-full" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Occupation & Compensation</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      {rolesList && rolesList.length > 0 ? (
                        <select
                          name="job_title"
                          required
                          value={selectedRole || editingEmp?.job_title || ''}
                          onChange={e => setSelectedRole(e.target.value)}
                          className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none"
                        >
                          <option value="">Pilih Jabatan (Role) *</option>
                          {rolesList.map((r: any) => (
                            <option key={r.id} value={r.name}>{r.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input name="job_title" placeholder="Job Title *" required defaultValue={editingEmp?.job_title || ''} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none" />
                      )}
                      {/* Department derived automatically from selected role — no manual input needed */}
                      <input
                        type="hidden"
                        name="department_id"
                        value={(() => {
                          const role = rolesList.find((r: any) => r.name === (selectedRole || editingEmp?.job_title))
                          return role?.department_ids?.[0] || role?.department_id || ''
                        })()}
                      />
                      <input
                        type="hidden"
                        name="role_id"
                        value={(() => {
                          const role = rolesList.find((r: any) => r.name === (selectedRole || editingEmp?.job_title))
                          return role?.id || editingEmp?.role_id || ''
                        })()}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <select name="employment_status" defaultValue={editingEmp?.employment_status || 'FULL_TIME'} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none">
                        <option value="FULL_TIME">FULL TIME</option>
                        <option value="CONTRACT">CONTRACT (PKWT)</option>
                        <option value="PROBATION">PROBATION</option>
                        <option value="INTERN">INTERNSHIP</option>
                      </select>
                      <CurrencyInput
                        label="Base Salary / Mo *"
                        name="basic_salary"
                        value={basicSalary}
                        onChange={setBasicSalary}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-1 bg-amber-600 rounded-full" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Banking & Tax (PTKP)</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <input name="bank_name" placeholder="Bank Name" defaultValue={editingEmp?.bank_name || ''} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none" />
                      <input name="bank_account_number" placeholder="Account Number" defaultValue={editingEmp?.bank_account_number || ''} className="col-span-2 px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Tax Status (PTKP PPh 21)</label>
                      <select name="tax_status" required defaultValue={editingEmp?.tax_status || ''} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none">
                        <option value="">-- SELECT STATUS --</option>
                        <option value="TK/0">TK/0 - Single, No Dependents</option>
                        <option value="TK/1">TK/1 - Single, 1 Dependent</option>
                        <option value="TK/2">TK/2 - Single, 2 Dependents</option>
                        <option value="TK/3">TK/3 - Single, 3 Dependents</option>
                        <option value="K/0">K/0 - Married, No Dependents</option>
                        <option value="K/1">K/1 - Married, 1 Dependent</option>
                        <option value="K/2">K/2 - Married, 2 Dependents</option>
                        <option value="K/3">K/3 - Married, 3 Dependents</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-1 bg-emerald-600 rounded-full" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Penugasan PIC Unit (Opsional)</h4>
                    </div>
                    <div className="space-y-2">
                       <p className="text-xs font-semibold text-slate-500 mb-3">
                          Pilih unit operasional yang akan dikelola oleh karyawan ini sebagai Manager (PIC).
                       </p>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 border border-slate-100 rounded-2xl p-3 bg-slate-50/50">
                          {branchOptions?.map((b: any) => (
                             <label key={b.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedManagedBranches.includes(b.id) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
                                <input type="checkbox" checked={selectedManagedBranches.includes(b.id)} onChange={(e) => {
                                   if(e.target.checked) setSelectedManagedBranches([...selectedManagedBranches, b.id])
                                   else setSelectedManagedBranches(selectedManagedBranches.filter(id => id !== b.id))
                                }} className="mt-0.5 h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 shrink-0" />
                                <div className="flex flex-col">
                                   <span className="text-sm font-bold text-slate-800 leading-none">{b.name}</span>
                                   <span className="text-[10px] font-bold text-slate-400 tracking-tight mt-1">{b.code}</span>
                                </div>
                             </label>
                          ))}
                          {(!branchOptions || branchOptions.length === 0) && (
                             <p className="text-xs text-slate-400 italic">Belum ada data unit.</p>
                          )}
                       </div>
                    </div>
                  </div>

                  {childOrgOptions?.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-1 bg-indigo-600 rounded-full" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Penugasan PIC Anak Perusahaan (Opsional)</h4>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500 mb-3">
                          Pilih anak perusahaan yang akan dipimpin oleh karyawan ini sebagai PIC Direktur/Manager.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 border border-slate-100 rounded-2xl p-3 bg-slate-50/50">
                          {childOrgOptions.map((childOrg: any) => (
                            <label key={childOrg.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedManagedChildOrgs.includes(childOrg.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
                              <input
                                type="checkbox"
                                checked={selectedManagedChildOrgs.includes(childOrg.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedManagedChildOrgs([...selectedManagedChildOrgs, childOrg.id])
                                  else setSelectedManagedChildOrgs(selectedManagedChildOrgs.filter((id) => id !== childOrg.id))
                                }}
                                className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
                              />
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-800 leading-none">{childOrg.name}</span>
                                <span className="text-[10px] font-bold text-slate-400 tracking-tight mt-1">ANAK PERUSAHAAN</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-10 border-t border-slate-50 bg-slate-50 flex justify-end gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-8 py-3 rounded-2xl text-[11px] font-semibold uppercase text-slate-400 hover:bg-slate-100 transition-all tracking-tight">CANCEL</button>
                <SafeButton
                  form="emp-form"
                  type="submit"
                  variant="primary"
                  size="lg"
                  icon={<Check size={18} />}
                  isLoading={loading}
                >
                  SAVE PROFILE
                </SafeButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTransferModalOpen && transferingEmp && (
          <div key="transfer-emp-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTransferModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-white"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/70">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100">
                    <ArrowRightLeft size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 tracking-tight uppercase italic">Mutasi Antar Entitas</h3>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-0.5">{transferingEmp.first_name} {transferingEmp.last_name || ''}</p>
                  </div>
                </div>
                <button onClick={() => setIsTransferModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-100">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitTransfer} className="p-8 space-y-6">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Asal</p>
                  <p className="text-sm font-black text-slate-800 mt-1">
                    {transferingEmp.branch?.name || '-'} • {transferingEmp.first_name} {transferingEmp.last_name || ''}
                  </p>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">NIK: {transferingEmp.nik || '-'}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Entitas Tujuan</label>
                  <select
                    required
                    value={transferTargetOrgId}
                    onChange={(e) => handleChangeTransferTargetOrg(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Pilih Entitas --</option>
                    {transferTargets.map((target: any) => (
                      <option key={target.orgId} value={target.orgId}>{target.orgName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Unit Tujuan</label>
                  <select
                    required
                    value={transferTargetBranchId}
                    onChange={(e) => setTransferTargetBranchId(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Pilih Unit --</option>
                    {selectedTransferBranches.map((branch: any) => (
                      <option key={branch.id} value={branch.id}>{branch.name} ({branch.code || '-'})</option>
                    ))}
                  </select>
                  {transferTargetOrgId && selectedTransferBranches.length === 0 && (
                    <p className="text-[11px] font-semibold text-amber-600">Entitas ini belum memiliki unit aktif yang bisa dipilih.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 flex items-start gap-3">
                  <input
                    id="transfer-pic-target"
                    type="checkbox"
                    checked={transferAsTargetPic}
                    onChange={(e) => setTransferAsTargetPic(e.target.checked)}
                    className="mt-1 h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="transfer-pic-target" className="text-xs font-bold text-emerald-700">
                    Setelah mutasi, tetapkan karyawan ini sebagai PIC pada unit tujuan.
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Catatan Mutasi (Opsional)</label>
                  <textarea
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    rows={3}
                    placeholder="Contoh: Mutasi operasional per 1 Mei 2026."
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[11px] font-semibold text-indigo-700">
                  Mutasi akan: memindahkan profil ke entitas tujuan, menghapus profil asal (atau fallback RESIGNED jika terikat histori transaksi), melepas PIC unit lama, dan menulis riwayat mutasi.
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsTransferModalOpen(false)} className="px-6 py-3 rounded-2xl text-[11px] font-semibold uppercase text-slate-400 hover:bg-slate-100 transition-all tracking-tight">
                    Batal
                  </button>
                  <SafeButton
                    type="submit"
                    variant="indigo"
                    size="lg"
                    icon={<ArrowRightLeft size={18} />}
                    isLoading={loading}
                    disabled={!transferTargetOrgId || !transferTargetBranchId}
                  >
                    Proses Mutasi
                  </SafeButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Run Detail Modal */}
      <AnimatePresence>
        {viewingRun && (
          <div key="run-detail-modal" className="fixed inset-0 z-50 flex items-center justify-end p-0 md:p-4">
            <motion.div key="run-detail-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingRun(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div
              key="run-detail-content"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="relative w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] bg-white md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                    <CalendarDays size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-800 tracking-tight">Detail Payroll: {new Date(viewingRun.period_start).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3>
                    <p className="text-sm text-slate-500 font-medium">Periode {viewingRun.period_start} s/d {viewingRun.period_end}</p>
                    {viewingRun.branch?.name && (
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 mt-1">{viewingRun.branch.name}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => setViewingRun(null)} className="p-2 bg-white text-slate-400 rounded-xl hover:text-slate-600 border border-slate-100 shadow-sm transition">
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-8 space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 tracking-tight mb-1">Total Gross</p>
                    <p className="text-sm font-black text-slate-800">{formatRupiah(viewingRun.total_gross)}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-[10px] font-bold text-red-300 tracking-tight mb-1">Total Potongan</p>
                    <p className="text-sm font-black text-red-600">{formatRupiah(viewingRun.total_deductions)}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 col-span-2 md:col-span-1">
                    <p className="text-[10px] font-bold text-emerald-400 tracking-tight mb-1">Total Netto Transfer</p>
                    <p className="text-sm font-black text-emerald-600">{formatRupiah(viewingRun.total_net)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Users size={16} /> Rincian Gaji Karyawan ({viewingRunData.length})
                  </h4>

                  <div className="space-y-3 pb-20">
                    {viewingRunData.map((slip: any) => (
                      <div key={slip.id} className="p-5 border border-slate-100 rounded-2xl bg-white hover:border-blue-200 transition">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className="font-bold text-slate-900">{slip.employee?.first_name} {slip.employee?.last_name}</div>
                            <div className="text-[10px] text-slate-400 font-semibold tracking-tight">{slip.employee?.nik} • {slip.employee?.job_title}</div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const printWindow = window.open('', '_blank');
                                  if (!printWindow) return;
                                  printWindow.document.write(`
                                           <html>
                                             <head>
                                               <title>Slip Gaji - ${slip.employee?.first_name}</title>
                                               <style>
                                                 body { font-family: sans-serif; padding: 40px; color: #333; }
                                                 .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                                                 .info { display: flex; justify-content: space-between; margin-bottom: 30px; }
                                                 .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
                                                 .section-title { font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; text-transform: uppercase; font-size: 12px; }
                                                 .row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px; }
                                                 .total { margin-top: 20px; padding-top: 10px; border-top: 2px solid #333; font-weight: bold; }
                                                 .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #999; }
                                               </style>
                                             </head>
                                             <body>
                                               <div class="header">
                                                 <h2 style="margin:0">SLIP GAJI KARYAWAN</h2>
                                                 <p style="margin:5px 0">Periode: ${new Date(viewingRun.period_start).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
                                               </div>
                                               <div class="info">
                                                 <div>
                                                   <strong>${slip.employee?.first_name} ${slip.employee?.last_name}</strong><br/>
                                                   NIK: ${slip.employee?.nik}<br/>
                                                   Jabatan: ${slip.employee?.job_title}
                                                 </div>
                                                 <div style="text-align:right">
                                                    Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}<br/>
                                                    Status: ${viewingRun.status}
                                                 </div>
                                               </div>
                                               <div class="grid">
                                                 <div>
                                                   <div class="section-title">Penerimaan (Earnings)</div>
                                                   ${(slip.lines || []).filter((l: any) => l.type === 'EARNING' || l.type === 'BENEFIT').map((l: any) => `
                                                     <div class="row"><span>${l.component_name}</span> <span>${formatRupiah(l.amount)}</span></div>
                                                   `).join('')}
                                                   ${(slip.lines || []).filter((l: any) => l.type === 'EARNING' || l.type === 'BENEFIT').length === 0 ? `
                                                     <div class="row"><span>Gaji Pokok</span> <span>${formatRupiah(slip.basic_salary)}</span></div>
                                                   ` : ''}
                                                 </div>
                                                 <div>
                                                   <div class="section-title">Potongan (Deductions)</div>
                                                   ${(slip.lines || []).filter((l: any) => l.type === 'DEDUCTION' || l.type === 'TAX').map((l: any) => `
                                                     <div class="row"><span>${l.component_name}</span> <span>${formatRupiah(l.amount)}</span></div>
                                                   `).join('')}
                                                   ${(slip.lines || []).filter((l: any) => l.type === 'DEDUCTION' || l.type === 'TAX').length === 0 ? '<div class="row"><span>-</span> <span>0</span></div>' : ''}
                                                 </div>
                                               </div>

                                               <div class="total">
                                                  <div class="row" style="font-size:18px">
                                                    <span>TOTAL GAJI NETTO</span>
                                                    <span>${formatRupiah(slip.net_salary)}</span>
                                                  </div>
                                               </div>
                                               <div class="footer">
                                                  Dokumen ini dihasilkan secara otomatis oleh NIZAM Payroll System.<br/>
                                                  Tanda tangan tidak diperlukan secara fisik.
                                               </div>
                                               <script>window.print();</script>
                                             </body>
                                           </html>
                                         `);
                                  printWindow.document.close();
                                }}
                                className="p-1 px-2 flex items-center gap-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 border border-slate-100 transition"
                                title="Cetak Slip Gaji"
                              >
                                <Printer size={12} /> <span className="text-[9px] font-bold uppercase tracking-tight">Cetak Slip</span>
                              </button>
                              <div className="text-sm font-black text-emerald-600">{formatRupiah(slip.net_salary)}</div>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">Net Income</div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-dashed border-slate-100 space-y-2">
                          {/* Lines (Includes Gaji Pokok) */}
                          {(slip.lines || []).length > 0 ? (
                            (slip.lines || []).map((line: any) => (
                              <div key={line.id} className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-medium">{line.component_name}</span>
                                <span className={`font-bold ${line.type === 'EARNING' || line.type === 'BENEFIT' ? 'text-blue-600' : 'text-red-500'}`}>
                                  {line.type === 'EARNING' || line.type === 'BENEFIT' ? '+' : '-'} {formatRupiah(line.amount)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-medium">Gaji Pokok (Header Only)</span>
                              <span className="text-slate-700 font-bold">{formatRupiah(slip.basic_salary)}</span>
                            </div>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button onClick={() => setViewingRun(null)} className="px-10 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition shadow-sm">Tutup</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-8 right-8 z-[9000] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800 shadow-emerald-200/50' :
              toast.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800 shadow-rose-200/50' :
              'bg-blue-50 border-blue-100 text-blue-800 shadow-blue-200/50'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={24} className="text-emerald-500 shrink-0" />}
            {toast.type === 'error' && <AlertCircle size={24} className="text-rose-500 shrink-0" />}
            {toast.type === 'info' && <AlertCircle size={24} className="text-blue-500 shrink-0" />}
            <p className="text-sm font-bold tracking-tight leading-tight max-w-sm">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-2 pl-4 border-l border-current opacity-60 hover:opacity-100 transition-opacity">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
