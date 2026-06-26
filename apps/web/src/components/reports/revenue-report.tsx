'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
  const totalRevenue = data?.totalRevenue ?? 0
  const byService = data?.byService ?? []
  const byProfessional = data?.byProfessional ?? []
  const dailyTrend = data?.dailyTrend ?? []
  const totalAppointments = data?.totalAppointments ?? 0
  const averageTicket = data?.averageTicket ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Receita Total" value={`R$ ${formatMoney(totalRevenue)}`} color="text-green-600" />
        <MetricCard label="Ticket Médio" value={`R$ ${formatMoney(averageTicket)}`} color="text-blue-600" />
        <MetricCard label="Total de Atendimentos" value={String(totalAppointments)} color="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueBarChart title="Receita por Serviço" data={byService} />
        <RevenueBarChart title="Receita por Profissional" data={byProfessional} color="#22c55e" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Tendência Diária de Receita</h3>
        <div className="h-72">
          {dailyTrend.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Sem dados para exibir.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [`R$ ${formatMoney(value)}`, 'Receita']}
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
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <DollarSign className={`h-4 w-4 ${color}`} />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function RevenueBarChart({
  title,
  data,
  color = '#3b82f6',
}: {
  title: string
  data: { name: string; revenue: number }[]
  color?: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">{title}</h3>
      <div className="h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Sem dados para exibir.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value: number) => [`R$ ${formatMoney(value)}`, 'Receita']}
              />
              <Bar dataKey="revenue" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
