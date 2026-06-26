'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Star, Wrench } from 'lucide-react'

interface ServiceRow {
  name: string
  appointments: number
  revenue: number
  averageRating: number
}

interface ServicesData {
  services?: ServiceRow[]
}

interface ServicesReportProps {
  data: ServicesData | null
}

export function ServicesReport({ data }: ServicesReportProps) {
  const services = [...(data?.services ?? [])].sort((a, b) => b.appointments - a.appointments)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 p-4">
          <Wrench className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Desempenho por Serviço</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Serviço</th>
                <th className="px-4 py-3 text-right">Agendamentos</th>
                <th className="px-4 py-3 text-right">Receita</th>
                <th className="px-4 py-3 text-right">Avaliação Média</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={4}>
                    Nenhum serviço encontrado no período.
                  </td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{service.name}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {service.appointments}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      R$ {service.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm text-gray-700">
                          {service.averageRating.toFixed(1)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Top Serviços por Agendamentos</h3>
        <div className="h-72">
          {services.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Sem dados para exibir.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={services} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  width={140}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="appointments" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
