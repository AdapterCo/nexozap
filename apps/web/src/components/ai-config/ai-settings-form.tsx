'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Bot,
  MessageSquare,
  ListChecks,
  HelpCircle,
  Clock,
  ToggleLeft,
  ToggleRight,
  Key,
  Zap,
  Brain,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiConfig {
  provider: string
  model: string
  apiKey: string
  personality: string
  tone: string
  rules: string[]
  faqs: { question: string; answer: string }[]
  allowedStart: string
  allowedEnd: string
  isActive: boolean
  dailyLimit: number
  monthlyLimit: number
}

interface AiSettingsFormProps {
  config: AiConfig
  onChange: (config: AiConfig) => void
}

const toneOptions = [
  { value: 'formal', label: 'Formal' },
  { value: 'informal', label: 'Informal' },
  { value: 'amigavel', label: 'Amigável' },
  { value: 'profissional', label: 'Profissional' },
  { value: 'descontraido', label: 'Descontraído' },
]

const providerOptions = [
  {
    id: 'OPENAI',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o Mini, GPT-3.5 Turbo',
    color: 'bg-green-100 text-green-700',
    icon: Brain,
    url: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'GROQ',
    name: 'Groq',
    description: 'Llama 3.1, Mixtral, Gemma - Ultra rápido',
    color: 'bg-orange-100 text-orange-700',
    icon: Zap,
    url: 'https://console.groq.com/keys',
  },
  {
    id: 'GEMINI',
    name: 'Google Gemini',
    description: 'Gemini 2.5 Flash, Gemini 1.5 Flash, Gemini 1.5 Pro',
    color: 'bg-blue-100 text-blue-700',
    icon: Sparkles,
    url: 'https://aistudio.google.com/apikey',
  },
]

const modelsByProvider: Record<string, { id: string; name: string }[]> = {
  OPENAI: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Rápido e econômico)' },
    { id: 'gpt-4o', name: 'GPT-4o (Mais inteligente)' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Mais barato)' },
  ],
  GROQ: [
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Ultra rápido)' },
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Versátil)' },
    { id: 'llama3-70b-8192', name: 'Llama 3 70B' },
    { id: 'llama3-8b-8192', name: 'Llama 3 8B (Rápido)' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
  ],
  GEMINI: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Mais novo, rápido e inteligente)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Rápido)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Mais inteligente)' },
    { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
  ],
}

function Sparkles(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  )
}

export function AiSettingsForm({ config, onChange }: AiSettingsFormProps) {
  const [newRule, setNewRule] = useState('')
  const [newFaqQuestion, setNewFaqQuestion] = useState('')
  const [newFaqAnswer, setNewFaqAnswer] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  const update = (partial: Partial<AiConfig>) => {
    onChange({ ...config, ...partial })
  }

  const addRule = () => {
    if (newRule.trim()) {
      update({ rules: [...config.rules, newRule.trim()] })
      setNewRule('')
    }
  }

  const removeRule = (index: number) => {
    update({ rules: config.rules.filter((_, i) => i !== index) })
  }

  const addFaq = () => {
    if (newFaqQuestion.trim() && newFaqAnswer.trim()) {
      update({
        faqs: [...config.faqs, { question: newFaqQuestion.trim(), answer: newFaqAnswer.trim() }],
      })
      setNewFaqQuestion('')
      setNewFaqAnswer('')
    }
  }

  const removeFaq = (index: number) => {
    update({ faqs: config.faqs.filter((_, i) => i !== index) })
  }

  const selectedProvider = providerOptions.find((p) => p.id === config.provider) || providerOptions[0]
  const availableModels = modelsByProvider[config.provider] || modelsByProvider.OPENAI

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Provedor de IA</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
          {providerOptions.map((provider) => {
            const Icon = provider.icon
            return (
              <button
                key={provider.id}
                onClick={() => update({ provider: provider.id, model: modelsByProvider[provider.id]?.[0]?.id || '' })}
                className={cn(
                  'relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all',
                  config.provider === provider.id
                    ? 'border-purple-500 bg-purple-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('rounded-lg p-1.5', provider.color)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium text-gray-900">{provider.name}</span>
                </div>
                <p className="text-xs text-gray-500">{provider.description}</p>
                {config.provider === provider.id && (
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-purple-500" />
                )}
              </button>
            )
          })}
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Modelo</label>
            <select
              value={config.model}
              onChange={(e) => update({ model: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Chave de API {selectedProvider.name}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder={`Cole sua chave de API do ${selectedProvider.name}...`}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-20 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                {showApiKey ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <a
                href={selectedProvider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
              >
                Obter chave de API <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-400">Deixe vazio para usar a chave do .env</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Personalidade e Comportamento</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Personalidade</label>
            <textarea
              value={config.personality}
              onChange={(e) => update({ personality: e.target.value })}
              placeholder="Ex: Amigável, profissional e prestativo"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Tom de Voz</label>
            <select
              value={config.tone}
              onChange={(e) => update({ tone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {toneOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              {config.isActive ? (
                <ToggleRight className="h-8 w-8 text-purple-600" />
              ) : (
                <ToggleLeft className="h-8 w-8 text-gray-400" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">IA Ativa</p>
                <p className="text-xs text-gray-500">
                  {config.isActive
                    ? 'O assistente IA está atendendo automaticamente'
                    : 'O assistente IA está desativado'}
                </p>
              </div>
            </div>
            <button
              onClick={() => update({ isActive: !config.isActive })}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                config.isActive ? 'bg-purple-600' : 'bg-gray-300'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  config.isActive ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Regras de Atendimento</h2>
        </div>

        <div className="space-y-2">
          {config.rules.map((rule, index) => (
            <div key={index} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <span className="flex-1 text-sm text-gray-700">{rule}</span>
              <button
                onClick={() => removeRule(index)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            placeholder="Digite uma nova regra..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button
            onClick={addRule}
            className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Perguntas Frequentes (FAQ)</h2>
        </div>

        <div className="space-y-3">
          {config.faqs.map((faq, index) => (
            <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">P: {faq.question}</p>
                  <p className="mt-1 text-sm text-gray-600">R: {faq.answer}</p>
                </div>
                <button
                  onClick={() => removeFaq(index)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <input
            type="text"
            value={newFaqQuestion}
            onChange={(e) => setNewFaqQuestion(e.target.value)}
            placeholder="Pergunta..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <div className="flex gap-2">
            <textarea
              value={newFaqAnswer}
              onChange={(e) => setNewFaqAnswer(e.target.value)}
              placeholder="Resposta..."
              rows={2}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
            <button
              onClick={addFaq}
              className="flex items-center gap-1 self-end rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Horário Permitido para IA</h2>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Início</label>
            <input
              type="time"
              value={config.allowedStart}
              onChange={(e) => update({ allowedStart: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <span className="mt-5 text-gray-400">até</span>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Fim</label>
            <input
              type="time"
              value={config.allowedEnd}
              onChange={(e) => update({ allowedEnd: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
