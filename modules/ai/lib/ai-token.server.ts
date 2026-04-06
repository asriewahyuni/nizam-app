import { prisma } from '@/lib/prisma'
import {
  DEFAULT_AI_TOKEN_POLICY,
  normalizeAiTokenPolicy,
  type AiTokenHeaderSummary,
  type AiTokenPolicy,
} from './ai-token'

type AiTokenWalletRow = {
  org_id: string
  balance_tokens: number
  total_purchased_tokens: number
  total_used_tokens: number
  low_balance_threshold: number
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function getAiTokenPolicyFromDb(): Promise<AiTokenPolicy> {
  const data = await prisma.saas_config.findUnique({
    where: { key: 'ai_token_policy' },
    select: { value: true },
  })

  return normalizeAiTokenPolicy(data?.value || DEFAULT_AI_TOKEN_POLICY)
}

export async function ensureAiTokenWallet(orgId: string, lowBalanceThreshold: number): Promise<AiTokenWalletRow> {
  const existing = await prisma.ai_token_wallets.findUnique({
    where: { org_id: orgId },
  })

  if (existing?.org_id) {
    return {
      org_id: existing.org_id,
      balance_tokens: toNumber(existing.balance_tokens, 0),
      total_purchased_tokens: toNumber(existing.total_purchased_tokens, 0),
      total_used_tokens: toNumber(existing.total_used_tokens, 0),
      low_balance_threshold: toNumber(existing.low_balance_threshold, lowBalanceThreshold),
    }
  }

  const created = await prisma.ai_token_wallets.create({
    data: {
      org_id: orgId,
      balance_tokens: 0,
      total_purchased_tokens: 0,
      total_used_tokens: 0,
      low_balance_threshold: lowBalanceThreshold,
    })
    .select('org_id, balance_tokens, total_purchased_tokens, total_used_tokens, low_balance_threshold')
    .single()

  if (createError || !created) {
    // Handle race conditions where another parallel request just created the wallet
    if ((createError as any)?.code === '23505' || createError?.message?.includes('duplicate key value')) {
      const { data: existingAfterConflict } = await db
        .from('ai_token_wallets')
        .select('org_id, balance_tokens, total_purchased_tokens, total_used_tokens, low_balance_threshold')
        .eq('org_id', orgId)
        .maybeSingle()

      if (existingAfterConflict?.org_id) {
        return {
          org_id: String(existingAfterConflict.org_id),
          balance_tokens: toNumber(existingAfterConflict.balance_tokens, 0),
          total_purchased_tokens: toNumber(existingAfterConflict.total_purchased_tokens, 0),
          total_used_tokens: toNumber(existingAfterConflict.total_used_tokens, 0),
          low_balance_threshold: toNumber(existingAfterConflict.low_balance_threshold, lowBalanceThreshold),
        }
      }
    }
    throw new Error(createError?.message || 'Gagal membuat wallet token AI')
  }

  return {
    org_id: created.org_id,
    balance_tokens: toNumber(created.balance_tokens, 0),
    total_purchased_tokens: toNumber(created.total_purchased_tokens, 0),
    total_used_tokens: toNumber(created.total_used_tokens, 0),
    low_balance_threshold: toNumber(created.low_balance_threshold, lowBalanceThreshold),
  }
}

export async function getAiTokenHeaderSummary(orgId: string): Promise<AiTokenHeaderSummary> {
  const policy = await getAiTokenPolicyFromDb()
  const wallet = await ensureAiTokenWallet(orgId, policy.lowBalanceThreshold)
  const perGeneration = Math.max(1, policy.tokensPerGeneration)

  return {
    balanceTokens: toNumber(wallet.balance_tokens, 0),
    lowBalanceThreshold: toNumber(wallet.low_balance_threshold, policy.lowBalanceThreshold),
    totalPurchasedTokens: toNumber(wallet.total_purchased_tokens, 0),
    totalUsedTokens: toNumber(wallet.total_used_tokens, 0),
    estimatedGenerationLeft: Math.floor(toNumber(wallet.balance_tokens, 0) / perGeneration),
  }
}

export async function consumeAiTokensForGeneration(params: {
  orgId: string
  userId: string
  requestedTokens: number
  source: 'sales_page_generate'
  note: string
  estimatedCostIdr?: number
  meta?: Record<string, unknown>
}) {
  const policy = await getAiTokenPolicyFromDb()
  const wallet = await ensureAiTokenWallet(params.orgId, policy.lowBalanceThreshold)
  const requested = Math.max(1, Math.round(params.requestedTokens))

  if (wallet.balance_tokens < requested) {
    throw new Error(
      `Token AI tidak cukup. Sisa ${wallet.balance_tokens.toLocaleString('id-ID')} token, butuh ${requested.toLocaleString('id-ID')} token. Silakan topup token AI terlebih dahulu.`,
    )
  }

  const nextBalance = wallet.balance_tokens - requested
  const nextUsed = wallet.total_used_tokens + requested

  await prisma.ai_token_wallets.update({
    where: { org_id: params.orgId },
    data: {
      balance_tokens: nextBalance,
      total_used_tokens: nextUsed,
      updated_at: new Date(),
    },
  })

  await prisma.ai_token_usage_logs.create({
    data: {
      org_id: params.orgId,
      user_id: params.userId,
      source: params.source,
      direction: 'DEBIT',
      tokens: requested,
      estimated_cost_idr: Math.max(0, toNumber(params.estimatedCostIdr, 0)),
      note: params.note,
      meta: (params.meta || {}) as never,
    },
  })

  return {
    consumedTokens: requested,
    balanceTokens: nextBalance,
    policy,
  }
}

export async function estimateCostFromUsageTokens(
  usage: { promptTokens: number; outputTokens: number },
): Promise<{ policy: AiTokenPolicy; estimatedCostIdr: number; billedTokens: number }> {
  const policy = await getAiTokenPolicyFromDb()
  const promptTokens = Math.max(0, Math.round(usage.promptTokens || 0))
  const outputTokens = Math.max(0, Math.round(usage.outputTokens || 0))
  const billedTokens = Math.max(1, promptTokens + outputTokens)
  const inputCost = (promptTokens / 1000) * policy.costPer1kInputIdr
  const outputCost = (outputTokens / 1000) * policy.costPer1kOutputIdr
  const estimatedCostIdr = inputCost + outputCost

  return { policy, estimatedCostIdr, billedTokens }
}
