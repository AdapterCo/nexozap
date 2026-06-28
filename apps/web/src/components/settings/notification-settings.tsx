'use client'

import { useCallback, useState, useEffect } from 'react'
import { Bell, Save, RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import useAuthStore from '@/stores/auth-store'

interface NotificationConfig {
  remindersActive: boolean
  template24h: string
  template2h: string
  templateAfter: string
}

const defaultTemplates = {
  template24h:
    'Olá {nome}! Este é um lembrete do seu agendamento de {serviço} com {profissional} amanh às {hora}. Caso queira remarcar, é só responder esta mensagem.',
  template2h:
    'Olá {nome}! Seu agendamento de {serviço} com {profissional} é às {hora} hoje. Estamos te esperando!',
  templateAfter:
    'Olá {nome}! Obrigado por nos visitar! Como foi sua experiência com {serviço}? Avalie atendimento respondendo de 1 a 5 estrelas.',
}

export function NotificationSettings() {
  const { company } = useAuthStore()
  const [config, setConfig] = useState<NotificationConfig>({
    remindersActive: true,
    template24h: defaultTemplates.template24h,
    template2h: defaultTemplates.template2h,
    templateAfter: defaultTemplates.templateAfter,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      if (!company?.id) return
      const res = await api.get(`/companies/${company.id}/notifications/config`)
      if (res.data) {
        setConfig({
          remindersActive: res.data.isEnabled ?? true,
          template24h: res.data.hours24Message || defaultTemplates.template24h,
          template2h: res.data.hours2Message || defaultTemplates.template2h,
          templateAfter: res.data.afterServiceMessage || defaultTemplates.templateAfter,
        })
      }
    } catch {
    }
  }, [company?.id])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const update = (partial: Partial<NotificationConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
    setSaved(false)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      if (!company?.id) return
      await api.patch(`/companies/${company.id}/notifications/config`, {
        isEnabled: config.remindersActive,
        hours24Message: config.template24h,
        hours2Message: config.template2h,
        afterServiceMessage: config.templateAfter,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const restoreDefault = (field: keyof typeof defaultTemplates) => {
    update({ [field]: defaultTemplates[field] })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Configurações de Notificações</h2>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4 mb-6">
          <div>
            <p className="text-sm font-medium text-gray-900">Lembretes Ativos</p>
            <p className="text-xs text-gray-500">
              Enviar lembretes automáticos para os clientes
            </p>
          </div>
          <button
            onClick={() => update({ remindersActive: !config.remindersActive })}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              config.remindersActive ? 'bg-green-600' : 'bg-gray-300'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                config.remindersActive ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Mensagem 24 horas antes
              </label>
              <button
                onClick={() => restoreDefault('template24h')}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="h-3 w-3" />
                Restaurar Padrão
              </button>
            </div>
            <textarea
              value={config.template24h}
              onChange={(e) => update({ template24h: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Variáveis disponíveis: {'{nome}'}, {'{hora}'}, {'{serviço}'}, {'{profissional}'}, {'{data}'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Mensagem 2 horas antes
              </label>
              <button
                onClick={() => restoreDefault('template2h')}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="h-3 w-3" />
                Restaurar Padrão
              </button>
            </div>
            <textarea
              value={config.template2h}
              onChange={(e) => update({ template2h: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Variáveis disponíveis: {'{nome}'}, {'{hora}'}, {'{serviço}'}, {'{profissional}'}, {'{data}'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Mensagem após atendimento
              </label>
              <button
                onClick={() => restoreDefault('templateAfter')}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="h-3 w-3" />
                Restaurar Padrão
              </button>
            </div>
            <textarea
              value={config.templateAfter}
              onChange={(e) => update({ templateAfter: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Variáveis disponíveis: {'{nome}'}, {'{serviço}'}, {'{profissional}'}
            </p>
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
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">Configurações salvas!</span>
          )}
        </div>
      </div>
    </div>
  )
}
