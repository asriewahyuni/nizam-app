/**
 * Helper preferensi tampilan Startup Wizard pada browser user saat ini.
 * Dipakai agar halaman dashboard dan halaman setting memakai kunci yang sama.
 */

export const STARTUP_WIZARD_HIDE_STORAGE_KEY = 'nizam_hide_tour'
export const STARTUP_WIZARD_VISIBILITY_EVENT = 'nizam_startup_wizard_visibility_change'

export function isStartupWizardHiddenInBrowser() {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(STARTUP_WIZARD_HIDE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setStartupWizardHiddenInBrowser(hidden: boolean) {
  if (typeof window === 'undefined') return

  try {
    if (hidden) {
      window.localStorage.setItem(STARTUP_WIZARD_HIDE_STORAGE_KEY, 'true')
    } else {
      window.localStorage.removeItem(STARTUP_WIZARD_HIDE_STORAGE_KEY)
    }
  } catch {
    // Abaikan error localStorage agar UI tetap jalan.
  }

  window.dispatchEvent(
    new CustomEvent(STARTUP_WIZARD_VISIBILITY_EVENT, {
      detail: { hidden },
    })
  )
}
