'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { DollarSign } from 'lucide-react'

interface RevenueData {
  totalRevenue?: number
  byService?: { name: string; revenue: number }[]
  byProfessional?: { name: string; revenue: number }[]
  dailyTrend?: { date: string; revenue: number }[]
  averageTicket?: number
  totalAppointments?: number
}

interface RevenueReportProps {
  data: RevenueData | null
}

export function RevenueReport({ data }: RevenueReportProps) {
  const totalRevenue = data?.totalRevenue || 4250
  const byService = data?.byService || [
    { name: 'Coloração', revenue: 2250 },
    { name: 'Tratamento', revenue: 1800 },
    { name: 'Corte', revenue: 1920 },
    { name: 'Barba', revenue: 960 },
    { name: 'Manicure', revenue: 500 },
  ]
  const byProfessional = data?.byProfessional || [
    { name: 'Ana Silva', revenue: 3200 },
    { name: 'Carlos Souza', revenue: 2800 },
    { name: 'Maria Santos', revenue: 2400 },
    { name: 'Pedro Lima', revenue: 1900 },
    { name: 'Julia Costa', revenue: 1600 },
  ]
  const dailyTrend =
    data?.dailyTrend ||
    Array.from({ length: 30 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (29 - i))
      return {
        date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        revenue: Math.floor(Math.random() * 300) + 50,
      }
    })
  const totalAppointments = data?.totalAppointments || 58
  const averageTicket = data?.averageTicket || totalRevenue / totalAppointments

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-gray-500">Receita Total</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-gray-500">Ticket Médio</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-medium text-gray-500">Total de Atendimentos</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{totalAppointments}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Receita por Serviço</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byService}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [
                    `R$ ${value.toLocaleString('pt-BR')}`,
                    'Receita',
                  ]}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Receita por Profissional</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProfessional}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [
                    `R$ ${value.toLocaleString('pt-BR')}`,
                    'Receita',
                  ]}
                />
                <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Tendência Diária de Receita</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value: number) => [
                  `R$ ${value.toLocaleString('pt-BR')}`,
                  'Receita',
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Receita"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#22c55e' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
