'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompanyForm } from '@/components/settings/company-form'
import { NotificationSettings } from '@/components/settings/notification-settings'
import { PlanInfo } from '@/components/settings/plan-info'

type Tab = 'company' | 'notifications' | 'plan'

const tabs: { value: Tab; label: string }[] = [
  { value: 'company', label: 'Empresa' },
  { value: 'notifications', label: 'Notificações' },
  { value: 'plan', label: 'Plano' },
]

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('company')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-gray-100 p-2">
          <Settings className="h-6 w-6 text-gray-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-sm text-gray-500">Gerencie as configurações da sua empresa</p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === 'company' && <CompanyForm />}
        {activeTab === 'notifications' && <NotificationSettings />}
        {activeTab === 'plan' && <PlanInfo />}
      </div>
    </div>
  )
}
