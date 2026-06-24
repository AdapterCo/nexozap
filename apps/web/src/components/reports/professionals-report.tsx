'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
  const professionals: ProfessionalRow[] = data?.professionals || [
    { name: 'Ana Silva', appointments: 38, revenue: 3200, rating: 4.9 },
    { name: 'Carlos Souza', appointments: 32, revenue: 2800, rating: 4.7 },
    { name: 'Maria Santos', appointments: 28, revenue: 2400, rating: 4.5 },
    { name: 'Pedro Lima', appointments: 22, revenue: 1900, rating: 4.8 },
    { name: 'Julia Costa', appointments: 18, revenue: 1600, rating: 4.6 },
  ]

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
              {professionals.map((prof) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Agendamentos por Profissional</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={professionals}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Bar dataKey="appointments" name="Agendamentos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Receita por Profissional</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={professionals}>
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
                <Legend />
                <Bar dataKey="revenue" name="Receita" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
