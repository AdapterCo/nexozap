'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Calendar } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { OverviewReport } from '@/components/reports/overview-report'
import { ServicesReport } from '@/components/reports/services-report'
import { ProfessionalsReport } from '@/components/reports/professionals-report'
import { AiUsageReport } from '@/components/reports/ai-usage-report'
import { RevenueReport } from '@/components/reports/revenue-report'

type Tab = 'overview' | 'services' | 'professionals' | 'ai' | 'revenue'

const tabs: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Visão Geral' },
  { value: 'services', label: 'Serviços' },
  { value: 'professionals', label: 'Profissionais' },
  { value: 'ai', label: 'IA' },
  { value: 'revenue', label: 'Receita' },
]

const presets = [
  { label: 'Hoje', getValue: () => ({ from: getToday(), to: getToday() }) },
  {
    label: 'Última semana',
    getValue: () => ({ from: getDaysAgo(7), to: getToday() }),
  },
  {
    label: 'Último mês',
    getValue: () => ({ from: getDaysAgo(30), to: getToday() }),
  },
  {
    label: 'Último trimestre',
    getValue: () => ({ from: getDaysAgo(90), to: getToday() }),
  },
]

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function getDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [from, setFrom] = useState(getDaysAgo(30))
  const [to, setTo] = useState(getToday())
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchReport()
  }, [from, to, activeTab])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const res = await api.get('/reports', { params: { from, to, type: activeTab } })
      setReportData(res.data)
    } catch {
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (preset: (typeof presets)[number]) => {
    const { from: f, to: t } = preset.getValue()
    setFrom(f)
    setTo(t)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-blue-100 p-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500">Analise o desempenho do seu negócio</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Período:</span>
        </div>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-gray-400">até</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex gap-1">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div>
          {activeTab === 'overview' && <OverviewReport data={reportData} />}
          {activeTab === 'services' && <ServicesReport data={reportData} />}
          {activeTab === 'professionals' && <ProfessionalsReport data={reportData} />}
          {activeTab === 'ai' && <AiUsageReport data={reportData} />}
          {activeTab === 'revenue' && <RevenueReport data={reportData} />}
        </div>
      )}
    </div>
  )
}
