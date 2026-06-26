'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Star, Users } from 'lucide-react'

interface ProfessionalRow {
  name: string
  appointments: number
  revenue: number
  rating: number
}

interface ProfessionalsData {
  professionals?: ProfessionalRow[]
}

interface ProfessionalsReportProps {
  data: ProfessionalsData | null
}

export function ProfessionalsReport({ data }: ProfessionalsReportProps) {
  const professionals = data?.professionals ?? []

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 p-4">
          <Users className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Desempenho por Profissional</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Profissional</th>
                <th className="px-4 py-3 text-right">Agendamentos</th>
                <th className="px-4 py-3 text-right">Receita</th>
                <th className="px-4 py-3 text-right">Avaliação</th>
              </tr>
            </thead>
            <tbody>
              {professionals.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={4}>
                    Nenhum profissional encontrado no período.
                  </td>
                </tr>
              ) : (
                professionals.map((prof) => (
                  <tr key={prof.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{prof.name}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {prof.appointments}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      R$ {prof.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm text-gray-700">{prof.rating.toFixed(1)}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Agendamentos por Profissional" data={professionals} dataKey="appointments" />
        <ChartCard title="Receita por Profissional" data={professionals} dataKey="revenue" currency />
      </div>
    </div>
  )
}

function ChartCard({
  title,
  data,
  dataKey,
  currency = false,
}: {
  title: string
  data: ProfessionalRow[]
  dataKey: 'appointments' | 'revenue'
  currency?: boolean
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
                formatter={(value: number) =>
                  currency ? [`R$ ${value.toLocaleString('pt-BR')}`, 'Receita'] : [value, 'Agendamentos']
                }
              />
              <Legend />
              <Bar
                dataKey={dataKey}
                name={currency ? 'Receita' : 'Agendamentos'}
                fill={currency ? '#22c55e' : '#3b82f6'}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
