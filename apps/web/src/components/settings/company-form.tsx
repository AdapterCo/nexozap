'use client'

import { useState, useEffect } from 'react'
import { Building2, Save } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

interface CompanyData {
  name: string
  ownerName: string
  whatsapp: string
  email: string
  address: string
  openingTime: string
  closingTime: string
  operatingDays: string[]
}

const allDays = [
  { value: 'segunda', label: 'Segunda' },
  { value: 'terca', label: 'Terça' },
  { value: 'quarta', label: 'Quarta' },
  { value: 'quinta', label: 'Quinta' },
  { value: 'sexta', label: 'Sexta' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
]

export function CompanyForm() {
  const { company } = useAuthStore()
  const [form, setForm] = useState<CompanyData>({
    name: '',
    ownerName: '',
    whatsapp: '',
    email: '',
    address: '',
    openingTime: '08:00',
    closingTime: '18:00',
    operatingDays: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || '',
        ownerName: company.ownerName || '',
        whatsapp: company.whatsapp || '',
        email: company.email || '',
        address: company.address || '',
        openingTime: company.openingTime || '08:00',
        closingTime: company.closingTime || '18:00',
        operatingDays: company.operatingDays || [
          'segunda', 'terca', 'quarta', 'quinta', 'sexta',
        ],
      })
    }
  }, [company])

  const update = (partial: Partial<CompanyData>) => {
    setForm((prev) => ({ ...prev, ...partial }))
    setSaved(false)
  }

  const formatWhatsApp = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await api.put('/company', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day: string) => {
    const days = form.operatingDays.includes(day)
      ? form.operatingDays.filter((d) => d !== day)
      : [...form.operatingDays, day]
    update({ operatingDays: days })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Informações da Empresa</h2>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nome da Empresa
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nome do Responsável
            </label>
            <input
              type="text"
              value={form.ownerName}
              onChange={(e) => update({ ownerName: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">WhatsApp</label>
            <input
              type="text"
              value={form.whatsapp}
              onChange={(e) => update({ whatsapp: formatWhatsApp(e.target.value) })}
              placeholder="(00) 00000-0000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update({ email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Endereço</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => update({ address: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Horário de Abertura
            </label>
            <input
              type="time"
              value={form.openingTime}
              onChange={(e) => update({ openingTime: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Horário de Fechamento
            </label>
            <input
              type="time"
              value={form.closingTime}
              onChange={(e) => update({ closingTime: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Dias de Atendimento
          </label>
          <div className="flex flex-wrap gap-2">
            {allDays.map((day) => (
              <button
                key={day.value}
                onClick={() => toggleDay(day.value)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  form.operatingDays.includes(day.value)
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-800 transition-colors',
            saving && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">Alterações salvas com sucesso!</span>
        )}
      </div>
    </div>
  )
}
