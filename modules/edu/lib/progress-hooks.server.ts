import 'server-only'

export async function nudgeEduModeValidation(source: string) {
  try {
    const { validateCurrentTrainingSession } = await import('@/modules/edu/lib/session.server')
    await validateCurrentTrainingSession()
  } catch (error) {
    ;(console as any).warn(`[edu-mode] validator nudge failed after ${source}`, error)
  }
}
