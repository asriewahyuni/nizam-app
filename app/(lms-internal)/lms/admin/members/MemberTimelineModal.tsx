'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Award,
  BookOpen,
  CheckCircle,
  UserPlus,
  Crown,
  Clock,
  Mail,
  Shield,
  Loader2,
  Calendar,
} from 'lucide-react'
import {
  MemberSummary,
  MemberTimelineEvent,
  getLmsMemberTimeline,
} from '@/modules/edu/actions/lms-members.actions'

interface MemberTimelineModalProps {
  isOpen: boolean
  onClose: () => void
  member: MemberSummary | null
}

export function MemberTimelineModal({ isOpen, onClose, member }: MemberTimelineModalProps) {
  const [events, setEvents] = useState<MemberTimelineEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'timeline' | 'badges'>('timeline')

  useEffect(() => {
    if (!isOpen || !member) {
      setEvents([])
      return
    }

    let isMounted = true
    setLoading(true)
    getLmsMemberTimeline(member.userId)
      .then((res) => {
        if (isMounted) {
          setEvents(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Error fetching member timeline:', err)
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, member])

  if (!isOpen || !member) return null

  const renderEventIcon = (type: string) => {
    switch (type) {
      case 'user-plus':
        return <UserPlus className="h-4 w-4 text-teal-600" />
      case 'book-open':
        return <BookOpen className="h-4 w-4 text-blue-600" />
      case 'check-circle':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />
      case 'crown':
        return <Crown className="h-4 w-4 text-amber-600" />
      case 'award':
      default:
        return <Award className="h-4 w-4 text-purple-600" />
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/40 bg-white/90 shadow-2xl backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200/80 bg-slate-50/50 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/10 text-xl font-extrabold text-indigo-600 ring-1 ring-indigo-500/20">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{member.name}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200/60">
                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                    Level {member.levelIndex}: {member.levelName}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {member.email}
                  </span>
                  <span className="inline-flex items-center gap-1 uppercase">
                    <Shield className="h-3.5 w-3.5 text-slate-400" />
                    {member.role}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Joined {new Date(member.joinedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 divide-x divide-slate-200/80 border-b border-slate-200/80 bg-white/60">
            <div className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Enrolled Courses</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{member.enrolledCount}</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Courses</div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">{member.completedCount}</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Earned Badges</div>
              <div className="mt-1 text-2xl font-bold text-purple-600">{member.badges.length}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200/80 bg-slate-50/30 px-6">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`border-b-2 py-3 px-4 text-sm font-bold transition-colors ${
                activeTab === 'timeline'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              History Timeline ({events.length})
            </button>
            <button
              onClick={() => setActiveTab('badges')}
              className={`border-b-2 py-3 px-4 text-sm font-bold transition-colors ${
                activeTab === 'badges'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Awarded Badges ({member.badges.length})
            </button>
          </div>

          {/* Content Body */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="mt-2 text-xs font-medium">Loading history timeline...</p>
              </div>
            ) : activeTab === 'timeline' ? (
              events.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No timeline events recorded yet.
                </div>
              ) : (
                <div className="relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  <div className="space-y-6">
                    {events.map((ev) => (
                      <div key={ev.id} className="relative flex items-start gap-4">
                        <div className="absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-100 shadow-sm">
                          {renderEventIcon(ev.iconType)}
                        </div>
                        <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm hover:shadow transition-shadow">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{ev.title}</h4>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                              <Clock className="h-3 w-3" />
                              {new Date(ev.timestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{ev.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              /* Badges Tab */
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {member.badges.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: b.color || '#0F766E' }}
                    >
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-slate-900">{b.title}</h4>
                        {b.isMilestone && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200">
                            Milestone
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {b.description || 'Special LMS achievement'}
                      </p>
                      {b.awardedAt && (
                        <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                          Earned {new Date(b.awardedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {member.badges.length === 0 && (
                  <div className="col-span-full py-12 text-center text-sm text-slate-500">
                    No badges earned yet.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-slate-200/80 bg-slate-50/50 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
