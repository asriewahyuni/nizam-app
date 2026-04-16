'use server'

import { getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { createAdminClient } from '@/lib/supabase/server'
import { ensureTrainingEvent } from '@/modules/edu/lib/training.server'
import {
  EDU_REALTIME_PILOT_QUESTION_LIMIT,
  DEFAULT_EDU_TIME_LIMIT_MINUTES,
  primeEduOrgContext,
  setEduSessionCookie,
} from '@/modules/edu/lib/session.server'

type SessionMutationResult = {
  ok?: true
  error?: string
  redirectTo?: string
  sessionId?: string
}

function normalizeRootOrgId(org: { id: string; parent_org_id?: string | null }) {
  const parentOrgId = String(org.parent_org_id || '').trim()
  return parentOrgId || String(org.id || '').trim()
}

export async function startTrainingSession(input: {
  teamId: string
  eventSlug?: string
}): Promise<SessionMutationResult> {
  const user = await getSession()
  if (!user?.id) {
    return { error: 'Login terlebih dahulu untuk memulai EDU Mode.' }
  }

  const activeOrg = await getActiveOrg()
  if (!activeOrg?.org?.id) {
    return { error: 'Organisasi aktif tidak ditemukan. Pilih organisasi terlebih dahulu.' }
  }

  const admin = (await createAdminClient()) as any
  const normalizedTeamId = String(input.teamId || '').trim()
  if (!normalizedTeamId) {
    return { error: 'Tim training tidak valid.' }
  }

  const rootOrgId = normalizeRootOrgId(activeOrg.org as { id: string; parent_org_id?: string | null })
  const event = await ensureTrainingEvent(input.eventSlug)

  const [{ data: teamRow, error: teamError }, { data: orgRow }] = await Promise.all([
    admin
      .from('training_teams')
      .select('id, event_id, name')
      .eq('id', normalizedTeamId)
      .maybeSingle(),
    admin
      .from('organizations')
      .select('id, name')
      .eq('id', rootOrgId)
      .maybeSingle(),
  ])

  if (teamError || !teamRow?.id) {
    return { error: teamError?.message || 'Tim training tidak ditemukan.' }
  }

  if (String(teamRow.event_id || '') !== String(event.id)) {
    return { error: 'Tim training tidak berada pada event yang sama.' }
  }

  const { data: existingSession } = await admin
    .from('training_sessions')
    .select('id, status')
    .eq('team_id', teamRow.id)
    .eq('org_id', rootOrgId)
    .in('status', ['ACTIVE', 'PAUSED'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingSession?.id) {
    await setEduSessionCookie(String(existingSession.id))
    await primeEduOrgContext(rootOrgId)
    return {
      ok: true,
      sessionId: String(existingSession.id),
      redirectTo: '/dashboard',
    }
  }

  const timeLimitMinutes = Number((event.settings as Record<string, unknown> | null)?.time_limit_minutes || DEFAULT_EDU_TIME_LIMIT_MINUTES)
  const normalizedTimeLimitMinutes =
    Number.isFinite(timeLimitMinutes) && timeLimitMinutes > 0
      ? Math.round(timeLimitMinutes)
      : DEFAULT_EDU_TIME_LIMIT_MINUTES
  const now = new Date()
  const deadlineAt = new Date(now.getTime() + normalizedTimeLimitMinutes * 60_000).toISOString()

  const { data: createdSession, error: sessionError } = await admin
    .from('training_sessions')
    .insert({
      event_id: event.id,
      team_id: teamRow.id,
      org_id: rootOrgId,
      active_branch_id: null,
      status: 'ACTIVE',
      current_question_id: 1,
      started_by: user.id,
      started_at: now.toISOString(),
      deadline_at: deadlineAt,
      metadata: {
        realtime_enabled: true,
        pilot_mode: true,
        question_limit: EDU_REALTIME_PILOT_QUESTION_LIMIT,
        source: 'edu-page',
        root_org_name: orgRow?.name || null,
      },
    })
    .select('id')
    .single()

  if (sessionError || !createdSession?.id) {
    return { error: sessionError?.message || 'Gagal membuat session EDU Mode.' }
  }

  const stepRows = Array.from({ length: EDU_REALTIME_PILOT_QUESTION_LIMIT }, (_, index) => ({
    session_id: createdSession.id,
    question_id: index + 1,
    status: index === 0 ? 'ACTIVE' : 'LOCKED',
    started_at: index === 0 ? now.toISOString() : null,
    validator_version: 'v1-pilot-1-5',
  }))

  const [{ error: stepError }, { error: eventLogError }, { error: teamUpdateError }, { error: scoreSeedError }] = await Promise.all([
    admin
      .from('training_session_steps')
      .insert(stepRows),
    admin
      .from('training_progress_events')
      .insert({
        session_id: createdSession.id,
        question_id: 1,
        event_type: 'session_started',
        severity: 'success',
        message: 'Session EDU Mode dimulai. Sistem realtime pilot aktif untuk soal 1-5.',
        source_module: 'edu',
        payload: {
          questionLimit: EDU_REALTIME_PILOT_QUESTION_LIMIT,
          timeLimitMinutes: normalizedTimeLimitMinutes,
        },
        created_by: user.id,
      }),
    admin
      .from('training_teams')
      .update({
        status: 'ACTIVE',
        elapsed_minutes: 0,
      })
      .eq('id', teamRow.id),
    admin
      .from('training_team_scores')
      .upsert(
        Array.from({ length: 15 }, (_, index) => ({
          team_id: teamRow.id,
          question_id: index + 1,
          transaction_ok: false,
          context_ok: false,
          evidence_ok: false,
          updated_by: user.id,
        })),
        { onConflict: 'team_id,question_id' }
      ),
  ])

  if (stepError || eventLogError || teamUpdateError || scoreSeedError) {
    return {
      error:
        stepError?.message ||
        eventLogError?.message ||
        teamUpdateError?.message ||
        scoreSeedError?.message ||
        'Session dibuat tetapi inisialisasi data realtime gagal.',
    }
  }

  await setEduSessionCookie(String(createdSession.id))
  await primeEduOrgContext(rootOrgId)

  return {
    ok: true,
    sessionId: String(createdSession.id),
    redirectTo: '/dashboard',
  }
}
