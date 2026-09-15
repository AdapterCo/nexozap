'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
  Calendar,
  Clock,
  User,
  Scissors,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Building2,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface AppointmentDetails {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  clientName: string
  clientPhone: string
  service: {
    id: string
    name: string
    durationMinutes: number
    price: number
  }
  professional: {
    id: string
    name: string
    availableDays: string[]
  }
  company?: {
    id: string
    name: string
    whatsapp?: string
  }
}

export default function RemarcarPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const appointmentId = params?.id as string
  const initialToken = searchParams?.get('token') || ''
  const initialPhone = searchParams?.get('phone') || ''

  const [accessToken, setAccessToken] = useState<string>(initialToken)
  const [phone, setPhone] = useState(initialPhone)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)

  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingSlots, setFetchingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [rescheduledSuccess, setRescheduledSuccess] = useState(false)

  // Min date is today (in yyyy-mm-dd)
  const today = new Date().toISOString().split('T')[0]

  const loadAppointment = useCallback(async (token: string) => {
    if (!appointmentId || !token) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setFeedback(null)
      const res = await api.get(`/clients/appointments/${appointmentId}`, {
        params: { accessToken: token },
      })
      setAppointment(res.data)
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Não foi possível carregar as informações do agendamento.',
      })
    } finally {
      setLoading(false)
    }
  }, [appointmentId])

  useEffect(() => {
    if (initialToken) {
      loadAppointment(initialToken)
    } else {
      setLoading(false)
    }
  }, [initialToken, loadAppointment])

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setFeedback({ type: 'error', message: 'Informe um telefone válido.' })
      return
    }

    try {
      setOtpSending(true)
      setFeedback(null)
      await api.post('/clients/send-otp', { phone: digits })
      setOtpSent(true)
      setFeedback({
        type: 'success',
        message: 'Código enviado por WhatsApp! Insira-o abaixo para continuar.',
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
    const digits = phone.replace(/\D/g, '')
    if (!otpCode || otpCode.length < 4) {
      setFeedback({ type: 'error', message: 'Digite o código de 6 dígitos recebido.' })
      return
    }

    try {
      setLoading(true)
      setFeedback(null)
      const res = await api.get('/clients/appointments', {
        params: { phone: digits, code: otpCode.trim() },
      })
      const found = Array.isArray(res.data)
        ? res.data.find((a: any) => a.id === appointmentId)
        : null

      if (found && found.accessToken) {
        setAccessToken(found.accessToken)
        await loadAppointment(found.accessToken)
      } else {
        setFeedback({
          type: 'error',
          message: 'Agendamento não encontrado para este telefone ou código incorreto.',
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Código de verificação inválido.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate)
    setSelectedSlot('')
    setAvailableSlots([])

    if (!newDate || !accessToken) return

    try {
      setFetchingSlots(true)
      const res = await api.get(`/clients/appointments/${appointmentId}/slots`, {
        params: { date: newDate, accessToken },
      })
      setAvailableSlots(Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Erro ao buscar horários disponíveis.',
      })
    } finally {
      setFetchingSlots(false)
    }
  }

  const handleRescheduleSubmit = async () => {
    if (!selectedDate || !selectedSlot) {
      setFeedback({ type: 'error', message: 'Selecione uma data e um horário disponível.' })
      return
    }

    try {
      setSubmitting(true)
      setFeedback(null)
      await api.post(`/clients/appointments/${appointmentId}/reschedule`, {
        newDate: selectedDate,
        newTime: selectedSlot,
        accessToken,
      })
      setRescheduledSuccess(true)
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Erro ao reagendar atendimento.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-xl">
        <button
          onClick={() => router.push('/cliente')}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para meus agendamentos
        </button>

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
          </div>
        )}

        {rescheduledSuccess ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Agendamento Remarcado!</h2>
            <p className="mt-2 text-sm text-gray-600">
              Seu horário foi alterado com sucesso para:
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              <Calendar className="h-4 w-4" />
              <span>{selectedDate} às {selectedSlot}</span>
            </div>
            <div className="mt-6">
              <button
                onClick={() => router.push('/cliente')}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Voltar para a lista de agendamentos
              </button>
            </div>
          </div>
        ) : !accessToken ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Validação de Segurança</h2>
              <p className="mt-1 text-xs text-gray-500">
                Para reagendar seu horário com segurança, confirme seu WhatsApp.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Seu número de WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSending || phone.length < 10}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {otpSending ? 'Enviando código...' : 'Receber Código via WhatsApp'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Código de 6 dígitos recebido no WhatsApp
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-widest font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading || otpCode.length < 4}
                    className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Validando...' : 'Confirmar e Continuar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : appointment ? (
          <div className="space-y-6">
            {/* Appointment Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Reagendar Atendimento</h2>

              <div className="space-y-2.5 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                {appointment.company?.name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="font-semibold">{appointment.company.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-gray-400" />
                  <span>{appointment.service.name} ({appointment.service.durationMinutes} min)</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span>Profissional: {appointment.professional.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>Horário atual: {appointment.date} às {appointment.startTime}</span>
                </div>
              </div>

              {/* Date selection */}
              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Escolha uma nova data
                </label>
                <input
                  type="date"
                  min={today}
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Slot selection */}
              {selectedDate && (
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Escolha um novo horário
                  </label>
                  {fetchingSlots ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      <span>Buscando horários disponíveis...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                      Nenhum horário disponível para esta data com este profissional. Por favor, selecione outra data.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            'rounded-lg border px-2.5 py-2 text-xs font-semibold transition-all text-center',
                            selectedSlot === slot
                              ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50'
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submit button */}
              <div className="mt-8 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={handleRescheduleSubmit}
                  disabled={submitting || !selectedDate || !selectedSlot}
                  className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Confirmando Reagendamento...' : 'Confirmar Reagendamento'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
