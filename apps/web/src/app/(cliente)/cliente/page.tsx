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
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Lock,
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
  accessToken: string | null
}

const statusConfig: Record<string, { label: string; color: string }> = {
  agendado: { label: 'Agendado', color: 'bg-blue-100 text-blue-700' },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
  nao_compareceu: { label: 'Não Compareceu', color: 'bg-yellow-100 text-yellow-700' },
}

export default function ClientePage() {
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [evaluationAppointment, setEvaluationAppointment] = useState<Appointment | null>(null)

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  const handleSearch = async (code?: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) return

    try {
      setLoading(true)
      setFeedback(null)
      const res = await api.get('/clients/appointments', {
        params: { phone: digits, ...(code ? { code } : {}) },
      })
      const list = Array.isArray(res.data)
        ? res.data.map((item: any) => ({
            ...item,
            service: item.service?.name ?? item.service,
            professional: item.professional?.name ?? item.professional,
            time: item.startTime ?? item.time,
            accessToken: item.accessToken ?? null,
            status:
              ({
                SCHEDULED: 'agendado',
                CONFIRMED: 'agendado',
                COMPLETED: 'concluido',
                CANCELLED: 'cancelado',
                NO_SHOW: 'nao_compareceu',
              } as Record<string, Appointment['status']>)[item.status] ?? item.status,
          }))
        : []

      setAppointments(list)
      const hasToken = list.some((a: Appointment) => !!a.accessToken)
      setIsVerified(hasToken)
      if (code && hasToken) {
        setFeedback({ type: 'success', message: 'Acesso autenticado com sucesso via WhatsApp!' })
      }
    } catch (err: any) {
      setAppointments([])
      setIsVerified(false)
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Erro ao buscar agendamentos.',
      })
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setFeedback({ type: 'error', message: 'Digite um número de WhatsApp válido primeiro.' })
      return
    }

    try {
      setOtpSending(true)
      setFeedback(null)
      await api.post('/clients/send-otp', { phone: digits })
      setOtpSent(true)
      setFeedback({
        type: 'success',
        message: 'Código de verificação enviado para o seu WhatsApp! Digite-o abaixo para liberar cancelamentos e reagendamentos.',
      })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Erro ao enviar código por WhatsApp.',
      })
    } finally {
      setOtpSending(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 4) {
      setFeedback({ type: 'error', message: 'Por favor, digite o código recebido.' })
      return
    }
    await handleSearch(otpCode.trim())
  }

  const handleCancel = async (id: string) => {
    const appointment = appointments.find((item) => item.id === id)
    if (!appointment?.accessToken) {
      setFeedback({
        type: 'error',
        message: 'Para cancelar, solicite e valide o código de segurança do WhatsApp acima.',
      })
      return
    }

    if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) {
      return
    }

    try {
      setCancelingId(id)
      setFeedback(null)
      await api.post(`/clients/appointments/${id}/cancel`, {
        accessToken: appointment.accessToken,
      })
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'cancelado' as const } : a))
      )
      setFeedback({ type: 'success', message: 'Agendamento cancelado com sucesso!' })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Não foi possível cancelar o agendamento.',
      })
    } finally {
      setCancelingId(null)
    }
  }

  const handleReschedule = (id: string) => {
    const appointment = appointments.find((item) => item.id === id)
    if (!appointment?.accessToken) {
      setFeedback({
        type: 'error',
        message: 'Para remarcar, solicite e valide o código de segurança do WhatsApp acima.',
      })
      return
    }
    window.location.href = `/cliente/remarcar/${id}?token=${appointment.accessToken}&phone=${phone.replace(/\D/g, '')}`
  }

  const handleOpenEvaluation = (apt: Appointment) => {
    if (!apt.accessToken) {
      setFeedback({
        type: 'error',
        message: 'Para avaliar, solicite e valide o código de segurança do WhatsApp acima.',
      })
      return
    }
    setEvaluationAppointment(apt)
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

        {feedback && (
          <div
            className={cn(
              'mb-6 flex items-start gap-3 rounded-lg border p-4 text-sm font-medium',
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            )}
          >
            {feedback.type === 'success' ? (
              <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            )}
            <p className="flex-1">{feedback.message}</p>
            <button
              onClick={() => setFeedback(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
              onClick={() => handleSearch()}
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

          <div className="mt-4 border-t border-gray-100 pt-4">
            {!isVerified ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/60 p-3.5 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2.5 text-xs text-blue-900">
                  <Lock className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>
                    Deseja cancelar, remarcar ou ver dados completos? Valide seu WhatsApp.
                  </span>
                </div>

                {!otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpSending || phone.replace(/\D/g, '').length < 10}
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {otpSending ? 'Enviando...' : 'Enviar Código WhatsApp'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Código"
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-xs text-center font-mono focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={loading || otpCode.length < 4}
                      className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Verificar
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-200">
                <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
                <span>Número verificado. Todas as ações de cancelamento e reagendamento liberadas.</span>
              </div>
            )}
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
                            disabled={cancelingId === apt.id}
                            className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <X className="h-3 w-3" />
                            {cancelingId === apt.id ? 'Cancelando...' : 'Cancelar'}
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
                          onClick={() => handleOpenEvaluation(apt)}
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

      {evaluationAppointment && evaluationAppointment.accessToken && (
        <EvaluationModal
          appointmentId={evaluationAppointment.id}
          accessToken={evaluationAppointment.accessToken}
          onClose={() => setEvaluationAppointment(null)}
        />
      )}
    </div>
  )
}
