'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { getBalanceSheet, getProfitLoss } from './reports.actions'

export interface FinancialRatios {
  // Liquidity
  currentRatio: { value: number; label: string; healthy: boolean; min: number; max: number }
  quickRatio: { value: number; label: string; healthy: boolean; min: number; max: number }
  cashRatio: { value: number; label: string; healthy: boolean; min: number; max: number }

  // Solvency
  debtToEquity: { value: number; label: string; healthy: boolean; min: number; max: number }
  debtToAssets: { value: number; label: string; healthy: boolean; min: number; max: number }
  equityRatio: { value: number; label: string; healthy: boolean; min: number; max: number }

  // Profitability
  grossProfitMargin: { value: number; label: string; healthy: boolean; min: number; max: number }
  netProfitMargin: { value: number; label: string; healthy: boolean; min: number; max: number }
  returnOnAssets: { value: number; label: string; healthy: boolean; min: number; max: number }
  returnOnEquity: { value: number; label: string; healthy: boolean; min: number; max: number }

  // Efficiency
  operatingExpenseRatio: { value: number; label: string; healthy: boolean; min: number; max: number }

  // Raw data
  raw: {
    totalAssets: number
    currentAssets: number
    nonCurrentAssets: number
    totalLiabilities: number
    currentLiabilities: number
    nonCurrentLiabilities: number
    totalEquity: number
    totalRevenue: number
    grossProfit: number
    netProfit: number
    operatingExpenses: number
    cashAndEquivalents: number
    inventory: number
  }

  period: {
    startDate: string
    endDate: string
  }
}

function classifyAccount(code: string, balance: number, type: string) {
  const codeStr = String(code || '').trim()
  const isCurrent =
    (type === 'ASSET' && /^(11|12|13|14)/.test(codeStr)) ||
    (type === 'LIABILITY' && /^(21|22)/.test(codeStr))

  const isCash =
    type === 'ASSET' && /^(1101|1102|1103|1104)/.test(codeStr)

  const isInventory =
    type === 'ASSET' && /^(14)/.test(codeStr)

  return { isCurrent, isCash, isInventory, balance: Number(balance) || 0 }
}

function computeRatio(value: number, denominator: number, min: number, max: number) {
  const result = denominator === 0 ? 0 : value / denominator
  return {
    value: Math.round(result * 100) / 100,
    healthy: result >= min && result <= max,
    min,
    max,
  }
}

function computePercent(value: number, denominator: number, min: number, max: number) {
  const result = denominator === 0 ? 0 : (value / denominator) * 100
  return {
    value: Math.round(result * 100) / 100,
    healthy: result >= min && result <= max,
    min,
    max,
  }
}

export async function getFinancialRatios(
  orgId: string,
  startDate?: string,
  endDate?: string
): Promise<FinancialRatios> {
  const bs = await getBalanceSheet(orgId, endDate)
  const pl = await getProfitLoss(orgId, startDate, endDate)

  const today = new Date().toISOString().split('T')[0]
  const sDate = startDate || `${today.slice(0, 7)}-01`
  const eDate = endDate || today

  // Parse balance sheet
  const allAssets = (bs.assets || []).map((a: any) =>
    classifyAccount(a.code, a.balance, 'ASSET'))
  const allLiabilities = (bs.liabilities || []).map((l: any) =>
    classifyAccount(l.code, l.balance, 'LIABILITY'))
  const allEquity = (bs.equity || []).map((e: any) => ({
    balance: Number(e.balance) || 0,
  }))

  const currentAssets = allAssets.filter(a => a.isCurrent).reduce((s, a) => s + a.balance, 0)
  const nonCurrentAssets = allAssets.filter(a => !a.isCurrent).reduce((s, a) => s + a.balance, 0)
  const totalAssets = allAssets.reduce((s, a) => s + a.balance, 0)

  const currentLiabilities = allLiabilities.filter(l => l.isCurrent).reduce((s, l) => s + l.balance, 0)
  const nonCurrentLiabilities = allLiabilities.filter(l => !l.isCurrent).reduce((s, l) => s + l.balance, 0)
  const totalLiabilities = allLiabilities.reduce((s, l) => s + l.balance, 0)

  const totalEquity = allEquity.reduce((s, e) => s + e.balance, 0)

  const cashAndEquivalents = allAssets.filter(a => a.isCash).reduce((s, a) => s + a.balance, 0)
  const inventory = allAssets.filter(a => a.isInventory).reduce((s, a) => s + a.balance, 0)

  // Parse P&L
  const totalRevenue = Number(pl.totalRevenue) || 0
  const totalExpenses = Number(pl.totalExpenses) || 0
  const netProfit = Number(pl.netProfit) || 0

  // Gross profit = Revenue - COGS
  // COGS typically code 5xxx
  const cogs = (pl.expenses || [])
    .filter((e: any) => String(e.code || '').startsWith('5'))
    .reduce((s: number, e: any) => s + Number(e.balance || 0), 0)
  const grossProfit = totalRevenue - cogs

  // Operating expenses = Non-COGS expenses (6xxx, 7xxx, 8xxx)
  const operatingExpenses = (pl.expenses || [])
    .filter((e: any) => !String(e.code || '').startsWith('5'))
    .reduce((s: number, e: any) => s + Number(e.balance || 0), 0)

  return {
    // Liquidity
    currentRatio: {
      label: 'Rasio Lancar',
      ...computeRatio(currentAssets, currentLiabilities, 1.5, 3.0),
    },
    quickRatio: {
      label: 'Rasio Cepat (Acid Test)',
      ...computeRatio(currentAssets - inventory, currentLiabilities, 0.5, 1.5),
    },
    cashRatio: {
      label: 'Rasio Kas',
      ...computeRatio(cashAndEquivalents, currentLiabilities, 0.1, 0.5),
    },

    // Solvency
    debtToEquity: {
      label: 'Debt to Equity Ratio (DER)',
      ...computeRatio(totalLiabilities, totalEquity, 0, 2.0),
    },
    debtToAssets: {
      label: 'Debt to Assets Ratio (DAR)',
      ...computeRatio(totalLiabilities, totalAssets, 0, 0.6),
    },
    equityRatio: {
      label: 'Rasio Ekuitas',
      ...computeRatio(totalEquity, totalAssets, 0.3, 0.7),
    },

    // Profitability
    grossProfitMargin: {
      label: 'Gross Profit Margin',
      ...computePercent(grossProfit, totalRevenue, 20, 60),
    },
    netProfitMargin: {
      label: 'Net Profit Margin',
      ...computePercent(netProfit, totalRevenue, 5, 25),
    },
    returnOnAssets: {
      label: 'Return on Assets (ROA)',
      ...computePercent(netProfit, totalAssets, 2, 15),
    },
    returnOnEquity: {
      label: 'Return on Equity (ROE)',
      ...computePercent(netProfit, totalEquity, 5, 25),
    },

    // Efficiency
    operatingExpenseRatio: {
      label: 'Rasio Beban Operasional',
      ...computePercent(operatingExpenses, totalRevenue, 0, 80),
    },

    // Raw data
    raw: {
      totalAssets,
      currentAssets,
      nonCurrentAssets,
      totalLiabilities,
      currentLiabilities,
      nonCurrentLiabilities,
      totalEquity,
      totalRevenue,
      grossProfit,
      netProfit,
      operatingExpenses,
      cashAndEquivalents,
      inventory,
    },

    period: { startDate: sDate, endDate: eDate },
  }
}
