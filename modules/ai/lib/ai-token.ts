export type AiTokenPolicy = {
  costPer1kInputIdr: number
  costPer1kOutputIdr: number
  avgInputTokens: number
  avgOutputTokens: number
  tokensPerGeneration: number
  overheadPercent: number
  marginPercent: number
  lowBalanceThreshold: number
}

export type AiTokenHeaderSummary = {
  balanceTokens: number
  lowBalanceThreshold: number
  estimatedGenerationLeft: number
  totalPurchasedTokens: number
  totalUsedTokens: number
}

export const DEFAULT_AI_TOKEN_POLICY: AiTokenPolicy = {
  costPer1kInputIdr: 7,
  costPer1kOutputIdr: 14,
  avgInputTokens: 2200,
  avgOutputTokens: 1800,
  tokensPerGeneration: 4000,
  overheadPercent: 15,
  marginPercent: 50,
  lowBalanceThreshold: 5000,
}

function toFiniteNumber(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

export function normalizeAiTokenPolicy(raw: unknown): AiTokenPolicy {
  const base = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}

  const costPer1kInputIdr = Math.max(0, toFiniteNumber(base.cost_per_1k_input_idr, DEFAULT_AI_TOKEN_POLICY.costPer1kInputIdr))
  const costPer1kOutputIdr = Math.max(0, toFiniteNumber(base.cost_per_1k_output_idr, DEFAULT_AI_TOKEN_POLICY.costPer1kOutputIdr))
  const avgInputTokens = Math.max(1, Math.round(toFiniteNumber(base.avg_input_tokens, DEFAULT_AI_TOKEN_POLICY.avgInputTokens)))
  const avgOutputTokens = Math.max(1, Math.round(toFiniteNumber(base.avg_output_tokens, DEFAULT_AI_TOKEN_POLICY.avgOutputTokens)))
  const tokensPerGeneration = Math.max(1, Math.round(toFiniteNumber(base.tokens_per_generation, DEFAULT_AI_TOKEN_POLICY.tokensPerGeneration)))
  const overheadPercent = Math.max(0, toFiniteNumber(base.overhead_percent, DEFAULT_AI_TOKEN_POLICY.overheadPercent))
  const marginPercent = Math.max(0, toFiniteNumber(base.margin_percent, DEFAULT_AI_TOKEN_POLICY.marginPercent))
  const lowBalanceThreshold = Math.max(0, Math.round(toFiniteNumber(base.low_balance_threshold, DEFAULT_AI_TOKEN_POLICY.lowBalanceThreshold)))

  return {
    costPer1kInputIdr,
    costPer1kOutputIdr,
    avgInputTokens,
    avgOutputTokens,
    tokensPerGeneration,
    overheadPercent,
    marginPercent,
    lowBalanceThreshold,
  }
}

export function calculateAiHppPerGeneration(policy: AiTokenPolicy): number {
  const inputCost = (policy.avgInputTokens / 1000) * policy.costPer1kInputIdr
  const outputCost = (policy.avgOutputTokens / 1000) * policy.costPer1kOutputIdr
  const base = inputCost + outputCost
  const overheadFactor = 1 + (policy.overheadPercent / 100)
  return base * overheadFactor
}

export function calculateAiRecommendedSellPerGeneration(policy: AiTokenPolicy): number {
  const hpp = calculateAiHppPerGeneration(policy)
  const marginFactor = 1 + (policy.marginPercent / 100)
  return hpp * marginFactor
}

export function calculateAiRecommendedSellPer1kTokens(policy: AiTokenPolicy): number {
  const sellPerGeneration = calculateAiRecommendedSellPerGeneration(policy)
  return (sellPerGeneration / policy.tokensPerGeneration) * 1000
}
