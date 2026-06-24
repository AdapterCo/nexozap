'use client'

import { useState, useEffect } from 'react'
import { Brain, Save } from 'lucide-react'
import api from '@/lib/api'
import useAuthStore from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { AiSettingsForm } from '@/components/ai-config/ai-settings-form'
import { TokenLimits } from '@/components/ai-config/token-limits'
import { UsageChart } from '@/components/ai-config/usage-chart'

export default function IaConfigPage() {
  const { company } = useAuthStore()
  const [config, setConfig] = useState({
    provider: 'OPENAI',
    model: 'gpt-4o-mini',
    apiKey: '',
    personality: '',
    tone: 'profissional' as string,
    rules: [] as string[],
    faqs: [] as { question: string; answer: string }[],
    allowedStart: '08:00',
    allowedEnd: '18:00',
    isActive: true,
    dailyLimit: 100000,
    monthlyLimit: 1000000,
  })
  const [usage, setUsage] = useState({ daily: 0, monthly: 0 })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchConfig()
    fetchUsage()
  }, [])

  const fetchConfig = async () => {
    if (!company?.id) return
    try {
      setLoading(true)
      const res = await api.get(`/companies/${company.id}/ai-config`)
      if (res.data) {
        setConfig({
          provider: res.data.provider || 'OPENAI',
          model: res.data.model || 'gpt-4o-mini',
          apiKey: res.data.apiKey || '',
          personality: res.data.personality || '',
          tone: res.data.toneOfVoice || 'profissional',
          rules: res.data.rules || [],
          faqs: res.data.faq || [],
          allowedStart: res.data.allowedHoursStart || '08:00',
          allowedEnd: res.data.allowedHoursEnd || '18:00',
          isActive: res.data.isActive ?? true,
          dailyLimit: res.data.dailyTokenLimit || 100000,
          monthlyLimit: res.data.monthlyTokenLimit || 1000000,
        })
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const fetchUsage = async () => {
    if (!company?.id) return
    try {
      const res = await api.get(`/dashboard/${company.id}/stats`)
      if (res.data) {
        setUsage({ daily: res.data.dailyTokenUsage || 0, monthly: res.data.monthlyTokenUsage || 0 })
      }
    } catch {
    }
  }

  const handleSave = async () => {
    if (!company?.id) return
    try {
      setSaving(true)
      setSaved(false)
      await api.post(`/companies/${company.id}/ai-config`, {
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey || undefined,
        personality: config.personality,
        toneOfVoice: config.tone,
        rules: config.rules,
        faq: config.faqs,
        isActive: config.isActive,
        dailyTokenLimit: config.dailyLimit,
        monthlyTokenLimit: config.monthlyLimit,
        allowedHoursStart: config.allowedStart,
        allowedHoursEnd: config.allowedEnd,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2">
            <Brain className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuração do Assistente IA</h1>
            <p className="text-sm text-gray-500">
              Configure o provedor, comportamento e limites do assistente inteligente
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 transition-colors',
            saving && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <AiSettingsForm config={config} onChange={setConfig} />
          <UsageChart />
        </div>
        <div className="space-y-6">
          <TokenLimits
            dailyLimit={config.dailyLimit}
            monthlyLimit={config.monthlyLimit}
            dailyUsage={usage.daily}
            monthlyUsage={usage.monthly}
            onChange={(limits) => setConfig((prev) => ({ ...prev, ...limits }))}
          />
        </div>
      </div>
    </div>
  )
}
