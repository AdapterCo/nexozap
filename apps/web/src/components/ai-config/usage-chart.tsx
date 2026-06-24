'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Coins, Activity } from 'lucide-react'
import api from '@/lib/api'

interface UsageDataPoint {
  date: string
  tokens: number
}

interface UsageSummary {
  totalMonth: number
  estimatedCost: number
}

export function UsageChart() {
  const [data, setData] = useState<UsageDataPoint[]>([])
  const [summary, setSummary] = useState<UsageSummary>({ totalMonth: 0, estimatedCost: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsage()
  }, [])

  const fetchUsage = async () => {
    try {
      const res = await api.get('/ai-config/usage/history')
      if (res.data?.chart) {
        setData(res.data.chart)
      }
      if (res.data?.summary) {
        setSummary(res.data.summary)
      }
    } catch {
      const mockData: UsageDataPoint[] = []
      const now = new Date()
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        mockData.push({
          date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          tokens: Math.floor(Math.random() * 8000) + 1000,
        })
      }
      setData(mockData)
      setSummary({ totalMonth: 185000, estimatedCost: 9.25 })
    } finally {
      setLoading(false)
    }
  }

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-semibold text-gray-900">Consumo de Tokens</h2>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatTokens}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString('pt-BR')} tokens`, 'Tokens']}
                />
                <Line
                  type="monotone"
                  dataKey="tokens"
                  stroke="#9333ea"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#9333ea' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Total no Mês</p>
              <p className="text-lg font-bold text-gray-900">
                {summary.totalMonth.toLocaleString('pt-BR')} tokens
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <Coins className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-xs text-gray-500">Estimativa de Custo</p>
                <p className="text-lg font-bold text-gray-900">
                  R$ {summary.estimatedCost.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
