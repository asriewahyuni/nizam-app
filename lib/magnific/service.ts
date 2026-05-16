/**
 * lib/magnific/service.ts
 *
 * Magnific API — Image & Video Generation Service
 * Digunakan untuk generate ekspresi/emotion biar chat Telegram lebih hidup.
 *
 * Docs: https://docs.magnific.com/quickstart
 * API Key: dari env MAGNIFIC_API_KEY
 *
 * Rate limit: max 20 request/hari (default, bisa diubah via env MAGNIFIC_DAILY_LIMIT)
 */

const MAGNIFIC_BASE_URL = 'https://api.magnific.com/v1'
const DEFAULT_DAILY_LIMIT = 20

// ─── Types ──────────────────────────────────────────────────────────────────

export type MagnificAspectRatio =
  | 'square_1_1'
  | 'classic_4_3'
  | 'traditional_3_4'
  | 'widescreen_16_9'
  | 'social_story_9_16'
  | 'smartphone_horizontal_20_9'
  | 'smartphone_vertical_9_20'
  | 'film_horizontal_21_9'
  | 'film_vertical_9_21'
  | 'standard_3_2'
  | 'portrait_2_3'
  | 'horizontal_2_1'
  | 'vertical_1_2'
  | 'social_5_4'
  | 'social_post_4_5'

export interface MagnificGenerateOptions {
  prompt: string
  aspect_ratio?: MagnificAspectRatio
  negative_prompt?: string
  style?: string
}

export interface MagnificTask {
  task_id: string
  status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  generated: string[]
  has_nsfw?: boolean[]
}

export interface MagnificGenerateResponse {
  success: boolean
  data?: MagnificTask
  error?: string
  remaining_today?: number
}

// ─── Daily Usage Tracker ────────────────────────────────────────────────────

const dailyUsage = new Map<string, { date: string; count: number }>()

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]
}

function getDailyLimit(): number {
  const envLimit = Number(process.env.MAGNIFIC_DAILY_LIMIT)
  return Number.isFinite(envLimit) && envLimit > 0 ? envLimit : DEFAULT_DAILY_LIMIT
}

export function getRemainingToday(): number {
  const today = getTodayKey()
  const usage = dailyUsage.get('global')
  if (!usage || usage.date !== today) {
    return getDailyLimit()
  }
  return Math.max(0, getDailyLimit() - usage.count)
}

export function hasReachedDailyLimit(): boolean {
  return getRemainingToday() <= 0
}

function incrementUsage(): void {
  const today = getTodayKey()
  const usage = dailyUsage.get('global')
  if (!usage || usage.date !== today) {
    dailyUsage.set('global', { date: today, count: 1 })
  } else {
    usage.count++
  }
}

// ─── API Key ─────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.MAGNIFIC_API_KEY
  if (!key) {
    throw new Error('MAGNIFIC_API_KEY tidak ditemukan di environment variables')
  }
  return key
}

// ─── Generate Image (Mystic) ─────────────────────────────────────────────────

export async function generateExpression(
  options: MagnificGenerateOptions
): Promise<MagnificGenerateResponse> {
  try {
    // Cek daily limit
    if (hasReachedDailyLimit()) {
      return {
        success: false,
        error: `Daily limit ${getDailyLimit()} request sudah tercapai. Coba lagi besok.`,
        remaining_today: 0,
      }
    }

    const apiKey = getApiKey()

    const requestBody: Record<string, unknown> = {
      prompt: options.prompt,
      aspect_ratio: options.aspect_ratio ?? 'square_1_1',
    }

    if (options.negative_prompt) {
      requestBody.negative_prompt = options.negative_prompt
    }
    if (options.style) {
      requestBody.style = options.style
    }

    const response = await fetch(`${MAGNIFIC_BASE_URL}/ai/mystic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-magnific-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return {
        success: false,
        error: `Magnific API error (${response.status}): ${errorBody}`,
        remaining_today: getRemainingToday(),
      }
    }

    const result = await response.json()
    const task = result.data as MagnificTask

    incrementUsage()

    return {
      success: true,
      data: task,
      remaining_today: getRemainingToday(),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      success: false,
      error: `Gagal generate ekspresi: ${message}`,
      remaining_today: getRemainingToday(),
    }
  }
}

// ─── Cek Task Status ─────────────────────────────────────────────────────────

export async function checkTaskStatus(taskId: string): Promise<MagnificGenerateResponse> {
  try {
    const apiKey = getApiKey()

    const response = await fetch(`${MAGNIFIC_BASE_URL}/ai/mystic/${taskId}`, {
      headers: {
        'x-magnific-api-key': apiKey,
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return {
        success: false,
        error: `Magnific API error (${response.status}): ${errorBody}`,
      }
    }

    const result = await response.json()
    return {
      success: true,
      data: result.data as MagnificTask,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      success: false,
      error: `Gagal cek status task: ${message}`,
    }
  }
}

// ─── Ekspresi Presets ────────────────────────────────────────────────────────

export const EXPRESSION_PRESETS: Record<string, string> = {
  happy: 'A cheerful happy expression, warm smile, bright colors, cartoon style',
  sad: 'A sad emotional expression, teary eyes, soft blue tones, cartoon style',
  angry: 'An angry frustrated expression, red background, cartoon style',
  surprised: 'A shocked surprised expression, wide eyes, mouth open, cartoon style',
  love: 'A loving affectionate expression, heart eyes, pink warm tones, cartoon style',
  confused: 'A confused puzzled expression, question marks, cartoon style',
  laughing: 'A laughing joyful expression, tears of joy, bright yellow background, cartoon style',
  cool: 'A cool confident expression, sunglasses, smirk, cartoon style',
  sleepy: 'A sleepy tired expression, yawning, droopy eyes, night blue tones, cartoon style',
  wink: 'A playful winking expression, smirk, cartoon style, cheeky vibe',
}

/**
 * Helper buat dapetin prompt ekspresi yang siap pakai
 */
export function getExpressionPrompt(emotion: string, customText?: string): string {
  const preset = EXPRESSION_PRESETS[emotion.toLowerCase()]
  if (preset) {
    return customText ? `${preset}, ${customText}` : preset
  }
  return customText || `A ${emotion} expression, cartoon style, vibrant colors`
}
