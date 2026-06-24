'use client'

import { AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TokenLimitsProps {
  dailyLimit: number
  monthlyLimit: number
  dailyUsage: number
  monthlyUsage: number
  onChange: (limits: { dailyLimit: number; monthlyLimit: number }) => void
}

const dailyPresets = [10000, 50000, 100000, 200000, 500000]
const monthlyPresets = [100000, 500000, 1000000, 2000000, 5000000]

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

function getPercentage(used: number, limit: number): number {
  if (limit === 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

export function TokenLimits({
  dailyLimit,
  monthlyLimit,
  dailyUsage,
  monthlyUsage,
  onChange,
}: TokenLimitsProps) {
  const dailyPct = getPercentage(dailyUsage, dailyLimit)
  const monthlyPct = getPercentage(monthlyUsage, monthlyLimit)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Limites de Tokens</h2>

        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Limite Diário</label>
              <span className="text-sm font-semibold text-purple-600">
                {formatTokens(dailyLimit)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={dailyPresets.length - 1}
              value={dailyPresets.indexOf(dailyLimit)}
              onChange={(e) => {
                const idx = Number(e.target.value)
                if (idx >= 0 && idx < dailyPresets.length) {
                  onChange({ dailyLimit: dailyPresets[idx], monthlyLimit })
                }
              }}
              className="w-full accent-purple-600"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              {dailyPresets.map((v) => (
                <span key={v}>{formatTokens(v)}</span>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Limite Mensal</label>
              <span className="text-sm font-semibold text-purple-600">
                {formatTokens(monthlyLimit)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={monthlyPresets.length - 1}
              value={monthlyPresets.indexOf(monthlyLimit)}
              onChange={(e) => {
                const idx = Number(e.target.value)
                if (idx >= 0 && idx < monthlyPresets.length) {
                  onChange({ dailyLimit, monthlyLimit: monthlyPresets[idx] })
                }
              }}
              className="w-full accent-purple-600"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              {monthlyPresets.map((v) => (
                <span key={v}>{formatTokens(v)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Uso Atual</h2>

        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-gray-600">Uso Diário</span>
              <span className="font-medium text-gray-900">
                {formatTokens(dailyUsage)} / {formatTokens(dailyLimit)}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-200">
              <div
                className={cn(
                  'h-2.5 rounded-full transition-all',
                  dailyPct >= 80 ? 'bg-red-500' : dailyPct >= 60 ? 'bg-yellow-500' : 'bg-purple-600'
                )}
                style={{ width: `${dailyPct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-gray-500">{dailyPct}% utilizado</p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-gray-600">Uso Mensal</span>
              <span className="font-medium text-gray-900">
                {formatTokens(monthlyUsage)} / {formatTokens(monthlyLimit)}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-200">
              <div
                className={cn(
                  'h-2.5 rounded-full transition-all',
                  monthlyPct >= 80
                    ? 'bg-red-500'
                    : monthlyPct >= 60
                      ? 'bg-yellow-500'
                      : 'bg-purple-600'
                )}
                style={{ width: `${monthlyPct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-gray-500">{monthlyPct}% utilizado</p>
          </div>
        </div>

        {(dailyPct >= 80 || monthlyPct >= 80) && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-700">
              {dailyPct >= 80 && monthlyPct >= 80
                ? 'Atenção: Você está se aproximando dos limites diário e mensal de tokens.'
                : dailyPct >= 80
                  ? 'Atenção: Você está se aproximando do limite diário de tokens.'
                  : 'Atenção: Você está se aproximando do limite mensal de tokens.'}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <Info className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-700">
            Ao atingir o limite, o atendimento mudará automaticamente para modo fluxo
          </p>
        </div>
      </div>
    </div>
  )
}
