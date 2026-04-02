'use client'

import React, { useEffect, useState } from 'react'
import { Plus, Shield, Trash2, Edit2, ShieldAlert, Link as LinkIcon, Copy, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type UsersClientProps = {
  orgId: string
  initialMembers: any[]
  branches: Array<{ id: string; name: string; code: string }>
  roles?: any[]
  initialInvitations?: any[]
}

const ALLOWED_MEMBER_ROLES = ['owner', 'admin', 'hr', 'manager', 'staff', 'viewer']

export default function UsersClient({
  orgId,
  initialMembers,
  branches,
  roles = [],
  initialInvitations = [],
}: UsersClientProps) {
  const [members, setMembers] = useState(initialMembers)
  const [invitations, setInvitations] = useState(initialInvitations)
  const [loading, setLoading] = useState(false)
  const [inviteLabel, setInviteLabel] = useState('')
  const [roleIdToInvite, setRoleIdToInvite] = useState('')
  const [inviteDuration, setInviteDuration] = useState('7')
  const [latestInviteUrl, setLatestInviteUrl] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [memberUnitsModal, setMemberUnitsModal] = useState<{ memberId: string; email: string; branchIds: string[] } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setMembers(initialMembers)
  }, [initialMembers])

  useEffect(() => {
    setInvitations(initialInvitations)
  }, [initialInvitations])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin)
    }
  }, [])

  const getInvitationUrl = (code: string) => {
    if (!baseUrl) return `/join/${code}`
    return `${baseUrl}/join/${code}`
  }

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value)
      alert(successMessage)
    } catch {
      alert('Gagal menyalin link. Silakan salin manual dari kotak yang tersedia.')
    }
  }

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData()
    formData.set('label', inviteLabel.trim() || 'Undangan Pengguna Baru')
    formData.set('duration', inviteDuration)
    if (roleIdToInvite) formData.set('role_id', roleIdToInvite)

    const { createInvitationToken } = await import('@/modules/organization/actions/org.actions')
    const res = await createInvitationToken(orgId, formData)

    if (res.error) {
      alert(res.error)
      setLoading(false)
      return
    }

    if (res.invitation) {
      setInvitations((current: any[]) => [res.invitation, ...current.filter((invite: any) => invite.id !== res.invitation.id)])
    }

    const nextUrl = getInvitationUrl(res.code ?? '')
    setLatestInviteUrl(nextUrl)
    setInviteLabel('')
    setRoleIdToInvite('')
    setInviteDuration('7')
    await copyToClipboard(nextUrl, 'Link aktivasi berhasil dibuat dan langsung disalin.')
    setLoading(false)
  }

  const handleDelete = async (memberId: string) => {
    if (!confirm('Hapus pengguna ini dari organisasi?')) return

    setLoading(true)
    const { error } = await (supabase as any).from('org_members').delete().eq('id', memberId)

    if (!error) {
      setMembers((current: any[]) => current.filter((member: any) => member.id !== memberId))
    } else {
      alert(error.message)
    }

    setLoading(false)
  }

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!confirm('Hapus link aktivasi ini?')) return

    setLoading(true)
    const { deleteInvitation } = await import('@/modules/organization/actions/org.actions')
    const res = await deleteInvitation(invitationId)

    if (res.success) {
      setInvitations((current: any[]) => current.filter((invite: any) => invite.id !== invitationId))
    }

    setLoading(false)
  }

  const handleUpdateRole = async (memberId: string, currentRole: string) => {
    const newRole = prompt('Masukkan peran baru (owner, admin, hr, manager, staff, viewer):', currentRole)
    if (!newRole) return

    const normalizedRole = newRole.toLowerCase()
    if (!ALLOWED_MEMBER_ROLES.includes(normalizedRole)) {
      alert('Peran tidak valid.')
      return
    }

    setLoading(true)
    const { error } = await (supabase as any).from('org_members').update({ role: normalizedRole }).eq('id', memberId)

    if (!error) {
      setMembers((current: any[]) => current.map((member: any) => (
        member.id === memberId ? { ...member, role: normalizedRole } : member
      )))
      window.location.reload()
    } else {
      alert(error.message)
    }

    setLoading(false)
  }

  const getAssignedBranchIds = (member: any) => {
    const assignments = Array.isArray(member.unit_assignments) ? member.unit_assignments : []
    return assignments
      .map((assignment: any) => String(assignment.branch_id || '').trim())
      .filter(Boolean)
  }

  const openUnitAccessModal = (member: any) => {
    setMemberUnitsModal({
      memberId: member.id,
      email: member.user?.email || member.user_id,
      branchIds: getAssignedBranchIds(member),
    })
  }

  const toggleMemberUnit = (branchId: string) => {
    setMemberUnitsModal((current) => {
      if (!current) return current
      const exists = current.branchIds.includes(branchId)
      return {
        ...current,
        branchIds: exists
          ? current.branchIds.filter((id) => id !== branchId)
          : [...current.branchIds, branchId],
      }
    })
  }

  const handleSaveMemberUnits = async () => {
    if (!memberUnitsModal) return
    setLoading(true)

    const { updateMemberUnitAccess } = await import('@/modules/organization/actions/org.actions')
    const res = await updateMemberUnitAccess(orgId, memberUnitsModal.memberId, memberUnitsModal.branchIds)

    if ((res as any).error) {
      alert((res as any).error)
      setLoading(false)
      return
    }

    const branchMap = new Map(branches.map((branch) => [branch.id, branch]))
    setMembers((current: any[]) =>
      current.map((member: any) =>
        member.id === memberUnitsModal.memberId
          ? {
              ...member,
              unit_assignments: memberUnitsModal.branchIds.map((branchId: string) => ({
                branch_id: branchId,
                branch: branchMap.get(branchId) || null,
              })),
            }
          : member
      )
    )

    setMemberUnitsModal(null)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Shield className="text-slate-600" size={32} />
          Pengguna & Hak Akses
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Pengaturan tim, pembuatan link aktivasi, dan pengelolaan level otorisasi pengguna di sistem ERP NIZAM.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1 border border-slate-100 bg-white rounded-3xl p-6 shadow-sm h-fit">
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Plus size={18} className="text-blue-500" />
            Buat Link Aktivasi
          </h3>
          <p className="text-sm text-slate-500 leading-6">
            Halaman ini sekarang memakai undangan berbasis token. Setelah link dibuat, bagikan URL aktivasi ke pengguna yang akan bergabung.
          </p>

          <form onSubmit={handleInvite} className="space-y-4 mt-5">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Label Undangan</label>
              <input
                type="text"
                required
                value={inviteLabel}
                onChange={(e) => setInviteLabel(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
                placeholder="Contoh: Staff Gudang Shift Pagi"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Role / Jabatan</label>
              <select
                value={roleIdToInvite}
                onChange={(e) => setRoleIdToInvite(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
              >
                <option value="">Staff Umum (default)</option>
                {roles.map((role: any) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Masa Berlaku</label>
              <select
                value={inviteDuration}
                onChange={(e) => setInviteDuration(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
              >
                <option value="0">Tanpa Batas</option>
                <option value="1">1 Hari</option>
                <option value="7">7 Hari</option>
                <option value="30">30 Hari</option>
              </select>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition disabled:opacity-50"
            >
              Buat & Salin Link
            </button>
          </form>

          {latestInviteUrl && (
            <div className="mt-5 p-4 rounded-2xl border border-blue-100 bg-blue-50 space-y-3">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                <LinkIcon size={16} />
                Link Aktivasi Terbaru
              </div>
              <p className="text-xs text-blue-700 break-all">{latestInviteUrl}</p>
              <button
                type="button"
                onClick={() => copyToClipboard(latestInviteUrl, 'Link aktivasi berhasil disalin ulang.')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white text-blue-700 text-xs font-bold border border-blue-200 hover:bg-blue-100 transition"
              >
                <Copy size={14} />
                Salin Lagi
              </button>
            </div>
          )}

          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 font-medium flex gap-3 items-start">
            <ShieldAlert size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p>Memberikan role dengan akses tinggi akan mempengaruhi akses keuangan, inventory, dan HRIS. Bagikan link aktivasi hanya ke pengguna yang sudah diverifikasi.</p>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2 space-y-6">
          <div className="border border-slate-100 bg-white rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">User ID & Info</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Peran (Role)</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Akses Unit</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {members.map((member: any) => (
                  <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 uppercase">
                          {member.user?.email?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">User ID: {member.user_id.substring(0, 8)}...</p>
                          <p className="text-xs text-slate-500">Mulai: {new Date(member.joined_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${
                          member.role === 'owner'
                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                            : member.role === 'hr'
                              ? 'bg-pink-50 text-pink-600 border-pink-100'
                              : member.role === 'admin'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {['owner', 'admin'].includes(member.role) ? (
                        <span className="text-xs font-bold text-emerald-600">Semua Unit</span>
                      ) : getAssignedBranchIds(member).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {getAssignedBranchIds(member).map((branchId: string) => {
                            const branch = branches.find((item) => item.id === branchId)
                            return (
                              <span
                                key={branchId}
                                className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-600"
                              >
                                {branch?.code || branch?.name || 'Unit'}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-rose-500">Belum ada akses unit</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!['owner', 'admin'].includes(member.role) && (
                          <button
                            onClick={() => openUnitAccessModal(member)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Atur Akses Unit"
                          >
                            <Shield size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateRole(member.id, member.role)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Ubah Peran"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(member.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus User"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-medium">Belum ada pengguna di organisasi ini.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border border-slate-100 bg-white rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Link Aktivasi Aktif</h3>
                <p className="text-sm text-slate-500">Daftar undangan yang bisa dibagikan atau dicabut dari halaman ini.</p>
              </div>
            </div>

            <div className="space-y-3">
              {invitations.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-400">
                  Belum ada link aktivasi yang aktif.
                </div>
              )}

              {invitations.map((invite: any) => (
                <div key={invite.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">{invite.label}</p>
                    <p className="text-xs text-slate-500">
                      Role: {invite.roles?.name || 'Staff Umum'} • Expired: {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : 'Tanpa batas'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">{getInvitationUrl(invite.invitation_code)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(getInvitationUrl(invite.invitation_code), 'Link aktivasi berhasil disalin.')}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition"
                    >
                      <Copy size={14} />
                      Salin
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteInvitation(invite.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition"
                    >
                      <Trash2 size={14} />
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {memberUnitsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMemberUnitsModal(null)}
          />
          <div className="relative w-full max-w-xl rounded-[32px] border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Atur Akses Unit</h3>
                <p className="text-sm text-slate-500">{memberUnitsModal.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setMemberUnitsModal(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {branches.map((branch) => {
                const checked = memberUnitsModal.branchIds.includes(branch.id)
                return (
                  <label
                    key={branch.id}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                      checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMemberUnit(branch.id)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{branch.name}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{branch.code}</div>
                    </div>
                  </label>
                )
              })}
            </div>

            {branches.length === 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
                Belum ada unit aktif yang bisa ditugaskan.
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setMemberUnitsModal(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSaveMemberUnits}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-100 disabled:opacity-50"
              >
                Simpan Akses Unit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
