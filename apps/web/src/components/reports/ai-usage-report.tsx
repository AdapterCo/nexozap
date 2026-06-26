'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Bot, DollarSign, TrendingDown, Zap } from 'lucide-react'

interface AiUsageData {
  dailyTokens?: number
  monthlyTokens?: number
  costBreakdown?: { label: string; value: number }[]
  aiTokens?: number
  flowTokens?: number
  estimatedSavings?: number
  trend?: { date: string; ai: number; flow: number }[]
}

interface AiUsageReportProps {
  data: AiUsageData | null
}

export function AiUsageReport({ data }: AiUsageReportProps) {
  const dailyTokens = data?.dailyTokens ?? 0
  const monthlyTokens = data?.monthlyTokens ?? 0
  const costBreakdown = data?.costBreakdown ?? []
  const aiTokens = data?.aiTokens ?? 0
  const flowTokens = data?.flowTokens ?? 0
  const estimatedSavings = data?.estimatedSavings ?? 0
  const trend = data?.trend ?? []
  const totalTokens = aiTokens + flowTokens

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={Bot} label="Tokens Diários" value={formatTokens(dailyTokens)} color="text-purple-600" />
        <Metric icon={Zap} label="Tokens Mensais" value={formatTokens(monthlyTokens)} color="text-blue-600" />
        <Metric
          icon={DollarSign}
          label="Custo Total"
          value={`R$ ${costBreakdown.reduce((sum, c) => sum + c.value, 0).toFixed(2)}`}
          color="text-green-600"
        />
        <Metric
          icon={TrendingDown}
          label="Economia Estimada"
          value={`R$ ${estimatedSavings.toFixed(2)}`}
          color="text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Comparativo: Modo IA vs Modo Fluxo</h3>
          {totalTokens === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-500">
              Sem uso de IA no período.
            </div>
          ) : (
            <div className="space-y-3">
              <UsageBar label="Modo IA" value={aiTokens} total={totalTokens} color="bg-purple-600" />
              <UsageBar label="Modo Fluxo" value={flowTokens} total={totalTokens} color="bg-blue-500" />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Quebra de Custos</h3>
          {costBreakdown.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-500">
              Sem custos registrados no período.
            </div>
          ) : (
            <div className="space-y-3">
              {costBreakdown.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    R$ {item.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Tendência de Uso da IA</h3>
        <div className="h-72">
          {trend.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Sem dados para exibir.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={formatTokens} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString('pt-BR')} tokens`,
                    name === 'ai' ? 'Modo IA' : 'Modo Fluxo',
                  ]}
                />
                <Legend formatter={(value) => (value === 'ai' ? 'Modo IA' : 'Modo Fluxo')} />
                <Line type="monotone" dataKey="ai" stroke="#9333ea" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="flow" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Bot
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function UsageBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-700">{formatTokens(value)} tokens</span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-200">
        <div className={`h-3 rounded-full ${color}`} style={{ width: `${(value / total) * 100}%` }} />
      </div>
    </div>
  )
}

function formatTokens(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
