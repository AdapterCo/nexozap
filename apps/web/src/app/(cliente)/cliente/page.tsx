'use client'

import { useState } from 'react'
import {
  Search,
  Calendar,
  Clock,
  User,
  X,
  RefreshCw,
  Star,
  MessageSquare,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { EvaluationModal } from '@/components/client/evaluation-modal'

interface Appointment {
  id: string
  service: string
  professional: string
  date: string
  time: string
  status: 'agendado' | 'concluido' | 'cancelado' | 'nao_compareceu'
}

const statusConfig: Record<string, { label: string; color: string }> = {
  agendado: { label: 'Agendado', color: 'bg-blue-100 text-blue-700' },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
  nao_compareceu: { label: 'Não Compareceu', color: 'bg-yellow-100 text-yellow-700' },
}

export default function ClientePage() {
  const [phone, setPhone] = useState('')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [evaluationAppointmentId, setEvaluationAppointmentId] = useState<string | null>(null)

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  const handleSearch = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) return

    try {
      setLoading(true)
      const res = await api.get('/client/appointments', { params: { phone: digits } })
      setAppointments(res.data?.appointments || [])
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await api.put(`/client/appointments/${id}/cancel`)
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'cancelado' as const } : a))
      )
    } catch {
    }
  }

  const handleReschedule = (id: string) => {
    window.open(`/cliente/remarcar/${id}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Consultar Agendamentos</h1>
          <p className="mt-2 text-gray-500">
            Informe seu número de WhatsApp para consultar seus agendamentos
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Número de WhatsApp
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="(00) 00000-0000"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className={cn(
                'flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Search className="h-4 w-4" />
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {searched && (
          <div className="space-y-3">
            {appointments.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <Calendar className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-3 text-gray-500">
                  Nenhum agendamento encontrado para este número.
                </p>
              </div>
            ) : (
              appointments.map((apt) => {
                const status = statusConfig[apt.status] || statusConfig.agendado
                return (
                  <div
                    key={apt.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{apt.service}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{apt.professional}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {apt.date} às {apt.time}
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          status.color
                        )}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                      {apt.status === 'agendado' && (
                        <>
                          <button
                            onClick={() => handleCancel(apt.id)}
                            className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <X className="h-3 w-3" />
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleReschedule(apt.id)}
                            className="flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Remarcar
                          </button>
                        </>
                      )}
                      {apt.status === 'concluido' && (
                        <button
                          onClick={() => setEvaluationAppointmentId(apt.id)}
                          className="flex items-center gap-1 rounded-lg border border-yellow-200 px-3 py-1.5 text-xs font-medium text-yellow-600 hover:bg-yellow-50 transition-colors"
                        >
                          <Star className="h-3 w-3" />
                          Avaliar Atendimento
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {evaluationAppointmentId && (
        <EvaluationModal
          appointmentId={evaluationAppointmentId}
          onClose={() => setEvaluationAppointmentId(null)}
        />
      )}
    </div>
  )
}
