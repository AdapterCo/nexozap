'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Bot, Zap, DollarSign, TrendingDown } from 'lucide-react'

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
  const dailyTokens = data?.dailyTokens || 5200
  const monthlyTokens = data?.monthlyTokens || 156000
  const costBreakdown = data?.costBreakdown || [
    { label: 'Modo IA', value: 7.8 },
    { label: 'Modo Fluxo', value: 1.2 },
  ]
  const aiTokens = data?.aiTokens || 98000
  const flowTokens = data?.flowTokens || 58000
  const estimatedSavings = data?.estimatedSavings || 340
  const trend =
    data?.trend ||
    Array.from({ length: 30 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (29 - i))
      return {
        date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        ai: Math.floor(Math.random() * 4000) + 2000,
        flow: Math.floor(Math.random() * 2000) + 500,
      }
    })

  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-medium text-gray-500">Tokens Diários</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatTokens(dailyTokens)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-gray-500">Tokens Mensais</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatTokens(monthlyTokens)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-gray-500">Custo Total</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            R$ {costBreakdown.reduce((sum, c) => sum + c.value, 0).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-medium text-gray-500">Economia Estimada</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">R$ {estimatedSavings.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">
            Comparativo: Modo IA vs Modo Fluxo
          </h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-600">Modo IA</span>
                <span className="font-medium text-purple-600">{formatTokens(aiTokens)} tokens</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-purple-600"
                  style={{
                    width: `${(aiTokens / (aiTokens + flowTokens)) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-600">Modo Fluxo</span>
                <span className="font-medium text-blue-600">{formatTokens(flowTokens)} tokens</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-blue-500"
                  style={{
                    width: `${(flowTokens / (aiTokens + flowTokens)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-sm text-emerald-700">
              Economia estimada: <span className="font-bold">R$ {estimatedSavings.toFixed(2)}</span> com
              o modo fluxo
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Quebra de Custos</h3>
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
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Tendência de Uso da IA</h3>
        <div className="h-72">
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
              <Legend
                formatter={(value) => (value === 'ai' ? 'Modo IA' : 'Modo Fluxo')}
              />
              <Line
                type="monotone"
                dataKey="ai"
                stroke="#9333ea"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="flow"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
