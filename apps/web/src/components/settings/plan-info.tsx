'use client'

import { useState, useEffect } from 'react'
import { Check, X, CreditCard, Users, MessageSquare, CalendarCheck } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

interface PlanDetails {
  name: string
  features: { label: string; included: boolean }[]
  limits: {
    appointments: { used: number; max: number }
    whatsapp: { used: number; max: number }
    professionals: { used: number; max: number }
  }
}

const plans: Record<string, PlanDetails> = {
  basico: {
    name: 'Básico',
    features: [
      { label: 'Agendamentos ilimitados', included: true },
      { label: '1 número WhatsApp', included: true },
      { label: '1 profissional', included: true },
      { label: 'Relatórios básicos', included: true },
      { label: 'Lembretes automáticos', included: true },
      { label: 'Assistente IA', included: false },
      { label: 'Multi-unidades', included: false },
      { label: 'API de integração', included: false },
    ],
    limits: {
      appointments: { used: 0, max: 500 },
      whatsapp: { used: 0, max: 1 },
      professionals: { used: 0, max: 1 },
    },
  },
  profissional: {
    name: 'Profissional',
    features: [
      { label: 'Agendamentos ilimitados', included: true },
      { label: '3 números WhatsApp', included: true },
      { label: '5 profissionais', included: true },
      { label: 'Relatórios avançados', included: true },
      { label: 'Lembretes automáticos', included: true },
      { label: 'Assistente IA', included: true },
      { label: 'Multi-unidades', included: false },
      { label: 'API de integração', included: false },
    ],
    limits: {
      appointments: { used: 0, max: 2000 },
      whatsapp: { used: 0, max: 3 },
      professionals: { used: 0, max: 5 },
    },
  },
  empresarial: {
    name: 'Empresarial',
    features: [
      { label: 'Agendamentos ilimitados', included: true },
      { label: 'WhatsApp ilimitado', included: true },
      { label: 'Profissionais ilimitados', included: true },
      { label: 'Relatórios completos', included: true },
      { label: 'Lembretes automáticos', included: true },
      { label: 'Assistente IA', included: true },
      { label: 'Multi-unidades', included: true },
      { label: 'API de integração', included: true },
    ],
    limits: {
      appointments: { used: 0, max: Infinity },
      whatsapp: { used: 0, max: Infinity },
      professionals: { used: 0, max: Infinity },
    },
  },
}

export function PlanInfo() {
  const { company } = useAuthStore()
  const [planData, setPlanData] = useState<PlanDetails>(plans.profissional)

  useEffect(() => {
    fetchPlan()
  }, [])

  const fetchPlan = async () => {
    try {
      const res = await api.get('/company/plan')
      if (res.data) {
        const planKey = res.data.plan || 'profissional'
        setPlanData({
          ...plans[planKey],
          limits: res.data.limits || plans[planKey].limits,
        })
      }
    } catch {
    }
  }

  const planKey = Object.keys(plans).find((k) => plans[k].name === planData.name) || 'profissional'

  const usageItems = [
    {
      label: 'Atendimentos',
      icon: CalendarCheck,
      used: planData.limits.appointments.used,
      max: planData.limits.appointments.max,
    },
    {
      label: 'WhatsApp',
      icon: MessageSquare,
      used: planData.limits.whatsapp.used,
      max: planData.limits.whatsapp.max,
    },
    {
      label: 'Profissionais',
      icon: Users,
      used: planData.limits.professionals.used,
      max: planData.limits.professionals.max,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Seu Plano</h2>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
              planKey === 'basico' && 'bg-gray-100 text-gray-700',
              planKey === 'profissional' && 'bg-purple-100 text-purple-700',
              planKey === 'empresarial' && 'bg-yellow-100 text-yellow-700'
            )}
          >
            {planData.name}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {planData.features.map((feature) => (
            <div key={feature.label} className="flex items-center gap-2">
              {feature.included ? (
                <Check className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <X className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <span
                className={cn(
                  'text-sm',
                  feature.included ? 'text-gray-700' : 'text-gray-400'
                )}
              >
                {feature.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Uso este Mês</h3>

        <div className="space-y-4">
          {usageItems.map((item) => {
            const pct =
              item.max === Infinity ? 0 : Math.min(100, (item.used / item.max) * 100)
            const displayMax = item.max === Infinity ? '∞' : item.max

            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">{item.label}</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {item.used} / {displayMax}
                  </span>
                </div>
                {item.max !== Infinity && (
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className={cn(
                        'h-2 rounded-full transition-all',
                        pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-purple-600'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <button className="w-full rounded-xl border border-gray-200 bg-white px-6 py-4 text-center text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 transition-colors">
        Fazer Upgrade
      </button>
    </div>
  )
}
