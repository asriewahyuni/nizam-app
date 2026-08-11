// Interpolasi {{var}} sederhana untuk template notifikasi — dipakai baik oleh
// worker outbox (server) maupun preview client yang perlu menampilkan hasil
// akhir sebuah template tanpa mengirim notifikasi sungguhan.

export function interpolate(template: string, values: Record<string, string | number | null>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key]
    return value == null ? '' : String(value)
  })
}
