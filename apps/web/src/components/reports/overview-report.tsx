'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  CalendarCheck,
  CheckCircle2,
  DollarSign,
  Star,
  TrendingUp,
  UserX,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface OverviewData {
  totalAppointments?: number
  completed?: number
  canceled?: number
  noShow?: number
  conversionRate?: number
  revenue?: number
  averageRating?: number
  statusBreakdown?: { name: string; value: number }[]
}

interface OverviewReportProps {
  data: OverviewData | null
}

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6']

export function OverviewReport({ data }: OverviewReportProps) {
  const total = data?.totalAppointments ?? 0
  const completed = data?.completed ?? 0
  const canceled = data?.canceled ?? 0
  const noShow = data?.noShow ?? 0
  const conversionRate = data?.conversionRate ?? 0
  const revenue = data?.revenue ?? 0
  const averageRating = data?.averageRating ?? 0
  const statusData = data?.statusBreakdown ?? []

  const summaryCards = [
    {
      label: 'Total de Atendimentos',
      value: total,
      icon: CalendarCheck,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Concluídos',
      value: completed,
      icon: CheckCircle2,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Cancelados',
      value: canceled,
      icon: XCircle,
      color: 'bg-red-100 text-red-600',
    },
    {
      label: 'Não Compareceu',
      value: noShow,
      icon: UserX,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: 'Taxa de Conversão',
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: 'bg-purple-100 text-purple-600',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className={cn('rounded-lg p-1.5', card.color)}>
                <card.icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Status dos Agendamentos</h3>
          <div className="h-72">
            {statusData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                Sem dados para exibir.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h3 className="text-sm font-medium text-gray-700">Receita no Período</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <h3 className="text-sm font-medium text-gray-700">Avaliação Média</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-3xl font-bold text-gray-900">{averageRating.toFixed(1)}</p>
              <span className="text-sm text-gray-500">/ 5.0</span>
            </div>
            <div className="mt-2 flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-4 w-4',
                    star <= Math.round(averageRating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
