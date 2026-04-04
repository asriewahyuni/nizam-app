const UNIT_ALIAS_MAP: Record<string, string> = {
  kg: 'kg',
  kilo: 'kg',
  kilogram: 'kg',
  g: 'gram',
  gr: 'gram',
  gram: 'gram',
  grams: 'gram',
  l: 'liter',
  lt: 'liter',
  ltr: 'liter',
  liter: 'liter',
  litre: 'liter',
  ml: 'ml',
  milliliter: 'ml',
  millilitre: 'ml',
  cc: 'ml',
  m: 'meter',
  meter: 'meter',
  metre: 'meter',
  cm: 'cm',
  centimeter: 'cm',
  centimetre: 'cm',
  pcs: 'pcs',
  pc: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  unit: 'unit',
  units: 'unit',
  satuan: 'unit',
}

const UNIT_CONVERSION_FACTORS: Record<string, number> = {
  'kg->gram': 1000,
  'gram->kg': 0.001,
  'liter->ml': 1000,
  'ml->liter': 0.001,
  'meter->cm': 100,
  'cm->meter': 0.01,
  'pcs->unit': 1,
  'unit->pcs': 1,
}

function roundQuantity(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  return Math.abs(rounded) < 1e-9 ? 0 : rounded
}

export function normalizeUnit(rawUnit?: string | null): string {
  const cleaned = String(rawUnit || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '')

  if (!cleaned) return ''
  return UNIT_ALIAS_MAP[cleaned] || cleaned
}

export function convertQuantityBetweenUnits(
  quantity: number,
  fromUnit?: string | null,
  toUnit?: string | null
): number {
  const parsedQuantity = Number(quantity)
  if (!Number.isFinite(parsedQuantity)) {
    throw new Error('Jumlah bahan baku tidak valid.')
  }

  const normalizedFrom = normalizeUnit(fromUnit || toUnit)
  const normalizedTo = normalizeUnit(toUnit || fromUnit)

  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return roundQuantity(parsedQuantity)
  }

  const factor = UNIT_CONVERSION_FACTORS[`${normalizedFrom}->${normalizedTo}`]
  if (typeof factor === 'number') {
    return roundQuantity(parsedQuantity * factor)
  }

  throw new Error(
    `Konversi satuan dari "${fromUnit || '-'}" ke "${toUnit || '-'}" belum didukung.`
  )
}
