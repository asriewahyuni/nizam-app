/**
 * Scheduler sederhana ala Laravel.
 * Satu runner akan mengecek task yang due, lalu mengeksekusi dan mencatat hasilnya di database.
 */

import { queryPostgres } from '@/lib/db/postgres'
import { sendWeeklySystemUsageReport } from '@/lib/activity/weekly-usage-report.server'
import { runDatabaseBackup } from '@/lib/backup/backup-db.server'

type SchedulerRunOptions = {
  dryRun?: boolean
  force?: boolean
  taskName?: string | null
  now?: Date
}

type SchedulerTaskContext = {
  dryRun: boolean
  now: Date
}

type SchedulerTaskExecutionResult = {
  summary?: string
  meta?: Record<string, unknown>
}

type SchedulerTaskDecision = {
  due: boolean
  scheduleKey: string
  currentWindowLabel: string
  nextRunLabel: string
}

type SchedulerTaskDefinition = {
  name: string
  description: string
  timezone: string
  decision: (now: Date) => SchedulerTaskDecision
  run: (context: SchedulerTaskContext) => Promise<SchedulerTaskExecutionResult>
}

type SchedulerTaskRunResult = {
  task: string
  due: boolean
  attempted: boolean
  skipped: boolean
  reason?: string
  success?: boolean
  scheduleKey: string
  currentWindowLabel: string
  nextRunLabel: string
  summary?: string
}

type SchedulerTaskRunRow = {
  id: number
}

type ZonedDateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
}

const WEEKDAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('id-ID')
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const data = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return {
    year: normalizeInteger(data.year, date.getUTCFullYear()),
    month: normalizeInteger(data.month, date.getUTCMonth() + 1),
    day: normalizeInteger(data.day, date.getUTCDate()),
    hour: normalizeInteger(data.hour, 0),
    minute: normalizeInteger(data.minute, 0),
    weekday: weekdayMap[String(data.weekday || 'Sun')] ?? 0,
  }
}

function formatZonedDateKey(parts: ZonedDateParts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function buildNextWeeklyRunLabel(now: Date, timeZone: string, dayOfWeek: number, hour: number, minute: number) {
  const nowParts = getZonedDateParts(now, timeZone)
  let offsetDays = (dayOfWeek - nowParts.weekday + 7) % 7

  const isSameDay = offsetDays === 0
  const passedToday = nowParts.hour > hour || (nowParts.hour === hour && nowParts.minute >= minute)

  if (isSameDay && passedToday) {
    offsetDays = 7
  }

  const nextDate = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000)
  const nextParts = getZonedDateParts(nextDate, timeZone)

  return `${WEEKDAY_LABELS[dayOfWeek]} ${pad(hour)}:${pad(minute)} ${timeZone} (${formatZonedDateKey(nextParts)})`
}

function buildCurrentWeeklyWindow(now: Date, timeZone: string, dayOfWeek: number, hour: number, minute: number) {
  const nowParts = getZonedDateParts(now, timeZone)
  let offsetDaysBack = (nowParts.weekday - dayOfWeek + 7) % 7

  const isSameDay = offsetDaysBack === 0
  const beforeTodayWindow = nowParts.hour < hour || (nowParts.hour === hour && nowParts.minute < minute)

  if (isSameDay && beforeTodayWindow) {
    offsetDaysBack = 7
  }

  const windowDate = new Date(now.getTime() - offsetDaysBack * 24 * 60 * 60 * 1000)
  const windowParts = getZonedDateParts(windowDate, timeZone)

  return {
    scheduleKey: `${formatZonedDateKey(windowParts)}-${pad(hour)}${pad(minute)}`,
    currentWindowLabel: `${WEEKDAY_LABELS[dayOfWeek]} ${pad(hour)}:${pad(minute)} ${timeZone} (${formatZonedDateKey(windowParts)})`,
  }
}

function createWeeklyTaskDecision(now: Date, options: { timeZone: string; dayOfWeek: number; hour: number; minute: number }): SchedulerTaskDecision {
  const parts = getZonedDateParts(now, options.timeZone)
  const due =
    parts.weekday === options.dayOfWeek &&
    parts.hour === options.hour &&
    parts.minute === options.minute
  const currentWindow = buildCurrentWeeklyWindow(now, options.timeZone, options.dayOfWeek, options.hour, options.minute)

  return {
    due,
    scheduleKey: currentWindow.scheduleKey,
    currentWindowLabel: currentWindow.currentWindowLabel,
    nextRunLabel: buildNextWeeklyRunLabel(now, options.timeZone, options.dayOfWeek, options.hour, options.minute),
  }
}

function getWeeklyUsageReportTask(): SchedulerTaskDefinition {
  const timeZone = normalizeText(process.env.WEEKLY_SYSTEM_USAGE_REPORT_TIMEZONE) || 'Asia/Jakarta'
  const dayOfWeek = Math.min(6, Math.max(0, normalizeInteger(process.env.WEEKLY_SYSTEM_USAGE_REPORT_DAY, 1)))
  const timeValue = normalizeText(process.env.WEEKLY_SYSTEM_USAGE_REPORT_TIME) || '07:00'
  const [hourRaw, minuteRaw] = timeValue.split(':')
  const hour = Math.min(23, Math.max(0, normalizeInteger(hourRaw, 7)))
  const minute = Math.min(59, Math.max(0, normalizeInteger(minuteRaw, 0)))

  return {
    name: 'weekly-system-usage-report',
    description: 'Kirim laporan pekanan analytics dan heatmap ke admin platform',
    timezone: timeZone,
    decision: (now) => createWeeklyTaskDecision(now, { timeZone, dayOfWeek, hour, minute }),
    run: async ({ dryRun }) => {
      const result = await sendWeeklySystemUsageReport({ dryRun })
      const failedCount = result.results.filter((item) => !item.success).length

      return {
        summary: `${result.report.periodLabel} | ${formatNumber(result.report.summary.routeVisits7d)} kunjungan | ${failedCount} gagal`,
        meta: {
          dryRun,
          recipients: result.recipients,
          periodLabel: result.report.periodLabel,
          summary: result.report.summary,
          failedCount,
        },
      }
    },
  }
}

function buildNextDailyRunLabel(now: Date, timeZone: string, hour: number, minute: number) {
  const nowParts = getZonedDateParts(now, timeZone)
  const passedToday = nowParts.hour > hour || (nowParts.hour === hour && nowParts.minute >= minute)
  const offsetDays = passedToday ? 1 : 0
  const nextDate = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000)
  const nextParts = getZonedDateParts(nextDate, timeZone)
  return `${pad(hour)}:${pad(minute)} ${timeZone} (${formatZonedDateKey(nextParts)})`
}

function buildCurrentDailyWindow(now: Date, timeZone: string, hour: number, minute: number) {
  const nowParts = getZonedDateParts(now, timeZone)
  const beforeTodayWindow = nowParts.hour < hour || (nowParts.hour === hour && nowParts.minute < minute)
  const windowDate = beforeTodayWindow
    ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
    : now
  const windowParts = getZonedDateParts(windowDate, timeZone)
  return {
    scheduleKey: `${formatZonedDateKey(windowParts)}-${pad(hour)}${pad(minute)}`,
    currentWindowLabel: `${pad(hour)}:${pad(minute)} ${timeZone} (${formatZonedDateKey(windowParts)})`,
  }
}

function createDailyTaskDecision(now: Date, options: { timeZone: string; hour: number; minute: number }): SchedulerTaskDecision {
  const parts = getZonedDateParts(now, options.timeZone)
  const due = parts.hour === options.hour && parts.minute === options.minute
  const currentWindow = buildCurrentDailyWindow(now, options.timeZone, options.hour, options.minute)
  return {
    due,
    scheduleKey: currentWindow.scheduleKey,
    currentWindowLabel: currentWindow.currentWindowLabel,
    nextRunLabel: buildNextDailyRunLabel(now, options.timeZone, options.hour, options.minute),
  }
}

function getDailyDbBackupTask(): SchedulerTaskDefinition {
  const timeZone = normalizeText(process.env.BACKUP_SCHEDULER_TIMEZONE) || 'Asia/Jakarta'
  // BACKUP_SCHEDULER_CRON format: "0 3 * * *" → ambil hour & minute saja
  const cronValue = normalizeText(process.env.BACKUP_SCHEDULER_CRON) || '0 3 * * *'
  const cronParts = cronValue.split(' ')
  const minute = Math.min(59, Math.max(0, normalizeInteger(cronParts[0], 0)))
  const hour = Math.min(23, Math.max(0, normalizeInteger(cronParts[1], 3)))

  return {
    name: 'daily-db-backup',
    description: 'Backup database PostgreSQL harian dan kirim ke Telegram admin',
    timezone: timeZone,
    decision: (now) => createDailyTaskDecision(now, { timeZone, hour, minute }),
    run: async ({ dryRun }) => {
      const result = await runDatabaseBackup(dryRun)
      if (!result.ok) {
        throw new Error(result.error || 'Backup gagal tanpa pesan error.')
      }
      return {
        summary: dryRun
          ? `DRY RUN — file: ${result.filename}`
          : `Sukses — ${result.filename} (${result.sizeMB} MB) → Telegram msg #${result.telegramMessageId}`,
        meta: {
          dryRun,
          filename: result.filename,
          sizeBytes: result.sizeBytes,
          sizeMB: result.sizeMB,
          telegramMessageId: result.telegramMessageId,
        },
      }
    },
  }
}

export function getScheduledTasks(): SchedulerTaskDefinition[] {
  return [
    getWeeklyUsageReportTask(),
    getDailyDbBackupTask(),
  ]
}

async function claimScheduledTaskRun(taskName: string, scheduleKey: string) {
  const result = await queryPostgres<SchedulerTaskRunRow>(
    `
      insert into public.scheduled_task_runs (
        task_name,
        schedule_key,
        status,
        started_at,
        created_at,
        updated_at
      )
      values (
        $1::text,
        $2::text,
        'running',
        now(),
        now(),
        now()
      )
      on conflict (task_name, schedule_key) do nothing
      returning id
    `,
    [taskName, scheduleKey]
  )

  return result.rows[0]?.id || null
}

async function finishScheduledTaskRun(
  runId: number,
  input: {
    status: 'success' | 'failed'
    summary?: string
    meta?: Record<string, unknown>
    errorMessage?: string
  }
) {
  await queryPostgres(
    `
      update public.scheduled_task_runs
      set
        status = $2::text,
        summary = $3::text,
        meta = $4::jsonb,
        error_message = $5::text,
        finished_at = now(),
        updated_at = now()
      where id = $1::bigint
    `,
    [
      runId,
      input.status,
      input.summary || null,
      JSON.stringify(input.meta || {}),
      input.errorMessage || null,
    ]
  )
}

export function listScheduledTasks(now: Date = new Date()) {
  return getScheduledTasks().map((task) => {
    const decision = task.decision(now)

    return {
      task: task.name,
      description: task.description,
      timezone: task.timezone,
      due: decision.due,
      currentWindowLabel: decision.currentWindowLabel,
      nextRunLabel: decision.nextRunLabel,
    }
  })
}

export async function runScheduledTasks(options: SchedulerRunOptions = {}) {
  const now = options.now || new Date()
  const dryRun = Boolean(options.dryRun)
  const force = Boolean(options.force)
  const requestedTask = normalizeText(options.taskName).toLowerCase()

  const tasks = getScheduledTasks().filter((task) => {
    if (!requestedTask) return true
    return task.name.toLowerCase() === requestedTask
  })

  if (requestedTask && tasks.length === 0) {
    throw new Error(`Task scheduler tidak ditemukan: ${requestedTask}`)
  }

  const results: SchedulerTaskRunResult[] = []

  for (const task of tasks) {
    const decision = task.decision(now)
    const due = force ? true : decision.due

    if (!due) {
      results.push({
        task: task.name,
        due: false,
        attempted: false,
        skipped: true,
        reason: 'Belum masuk jadwal eksekusi.',
        scheduleKey: decision.scheduleKey,
        currentWindowLabel: decision.currentWindowLabel,
        nextRunLabel: decision.nextRunLabel,
      })
      continue
    }

    if (dryRun) {
      const execution = await task.run({ dryRun: true, now })
      results.push({
        task: task.name,
        due: decision.due,
        attempted: true,
        skipped: false,
        success: true,
        scheduleKey: decision.scheduleKey,
        currentWindowLabel: decision.currentWindowLabel,
        nextRunLabel: decision.nextRunLabel,
        summary: execution.summary,
      })
      continue
    }

    const runId = await claimScheduledTaskRun(task.name, decision.scheduleKey)

    if (!runId) {
      results.push({
        task: task.name,
        due: decision.due,
        attempted: false,
        skipped: true,
        reason: 'Task pada window ini sudah pernah dijalankan.',
        scheduleKey: decision.scheduleKey,
        currentWindowLabel: decision.currentWindowLabel,
        nextRunLabel: decision.nextRunLabel,
      })
      continue
    }

    try {
      const execution = await task.run({ dryRun: false, now })
      await finishScheduledTaskRun(runId, {
        status: 'success',
        summary: execution.summary,
        meta: execution.meta,
      })

      results.push({
        task: task.name,
        due: decision.due,
        attempted: true,
        skipped: false,
        success: true,
        scheduleKey: decision.scheduleKey,
        currentWindowLabel: decision.currentWindowLabel,
        nextRunLabel: decision.nextRunLabel,
        summary: execution.summary,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Task scheduler gagal dijalankan.'

      await finishScheduledTaskRun(runId, {
        status: 'failed',
        errorMessage,
      })

      results.push({
        task: task.name,
        due: decision.due,
        attempted: true,
        skipped: false,
        success: false,
        reason: errorMessage,
        scheduleKey: decision.scheduleKey,
        currentWindowLabel: decision.currentWindowLabel,
        nextRunLabel: decision.nextRunLabel,
      })
    }
  }

  return results
}
