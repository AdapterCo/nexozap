'use client'

import { useCallback, useState, useEffect } from 'react'
import { Check, X, CreditCard, Users, MessageSquare, CalendarCheck, QrCode, Copy, Lock, Loader2, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import useAuthStore from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import Script from 'next/script'

declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface PlanDetails {
  name: string
  price: string
  features: { label: string; included: boolean }[]
  limits: {
    appointments: { used: number; max: number }
    whatsapp: { used: number; max: number }
    professionals: { used: number; max: number }
  }
}

const plans: Record<string, PlanDetails> = {
  basico: {
    name: 'Essencial',
    price: '1,00',
    features: [
      { label: 'Agendamentos ilimitados', included: true },
      { label: '1 número WhatsApp', included: true },
      { label: '2 profissionais', included: true },
      { label: '5 serviços cadastrados', included: true },
      { label: 'Relatórios básicos', included: true },
      { label: 'Lembretes automáticos', included: true },
      { label: 'Assistente IA', included: false },
      { label: 'API de integração', included: false },
    ],
    limits: {
      appointments: { used: 0, max: 500 },
      whatsapp: { used: 0, max: 1 },
      professionals: { used: 0, max: 2 },
    },
  },
  profissional: {
    name: 'Profissional',
    price: '1,50',
    features: [
      { label: 'Agendamentos ilimitados', included: true },
      { label: '2 números WhatsApp', included: true },
      { label: '10 profissionais', included: true },
      { label: '20 serviços cadastrados', included: true },
      { label: 'Relatórios avançados', included: true },
      { label: 'Lembretes automáticos', included: true },
      { label: 'Assistente IA', included: true },
      { label: 'API de integração', included: false },
    ],
    limits: {
      appointments: { used: 0, max: 2000 },
      whatsapp: { used: 0, max: 2 },
      professionals: { used: 0, max: 10 },
    },
  },
  empresarial: {
    name: 'Empresarial',
    price: '2,00',
    features: [
      { label: 'Agendamentos ilimitados', included: true },
      { label: 'WhatsApp ilimitado', included: true },
      { label: 'Profissionais ilimitados', included: true },
      { label: 'Serviços ilimitados', included: true },
      { label: 'Relatórios completos', included: true },
      { label: 'Lembretes automáticos', included: true },
      { label: 'Assistente IA', included: true },
      { label: 'API de integração', included: true },
    ],
    limits: {
      appointments: { used: 0, max: 999999 },
      whatsapp: { used: 0, max: 999 },
      professionals: { used: 0, max: 999 },
    },
  },
}

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || 'APP_USR-da9d42ff-df4a-43c3-888e-cbfb40a5a3a7'

export function PlanInfo() {
  const { company, setCompany } = useAuthStore()
  const [currentPlanKey, setCurrentPlanKey] = useState<string>('basico')
  const [planLimits, setPlanLimits] = useState<PlanDetails['limits']>(plans.basico.limits)
  const [selectedPlan, setSelectedPlan] = useState<{ key: string; details: PlanDetails } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix'>('pix')
  
  // Checkout states
  const [loading, setLoading] = useState(false)
  const [mpLoaded, setMpLoaded] = useState(false)
  const [paymentResult, setPaymentResult] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  // Card Form Inputs
  const [cardInputs, setCardInputs] = useState({
    cardNumber: '',
    cardholderName: '',
    expirationDate: '',
    securityCode: '',
    docNumber: '',
  })

  const fetchPlan = useCallback(async () => {
    try {
      if (!company?.id) return
      const res = await api.get(`/companies/${company.id}/billing/plan`)
      if (res.data) {
        const key = ({ BASIC: 'basico', PROFESSIONAL: 'profissional', ENTERPRISE: 'empresarial' } as Record<string, string>)[res.data.plan] || 'basico'
        setCurrentPlanKey(key)
        setPlanLimits(res.data.limits)
      }
    } catch (err) {
      console.error('Erro ao buscar plano:', err)
    }
  }, [company?.id])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  // Polling for Pix status
  useEffect(() => {
    if (!paymentResult || paymentResult.status !== 'PENDING' || paymentResult.qrCode === undefined) return

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/companies/${company?.id}/billing/payments/${paymentResult.id}`)
        if (res.data && res.data.status === 'APPROVED') {
          setPaymentResult(res.data)
          clearInterval(interval)
          // Atualiza dados da empresa
          if (company) {
            setCompany({ ...company, plan: res.data.plan })
          }
          fetchPlan()
        }
      } catch (err) {
        console.error('Erro no polling do Pix:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [company, fetchPlan, paymentResult, setCompany])

  const handleCopyPix = () => {
    if (!paymentResult?.qrCode) return
    navigator.clipboard.writeText(paymentResult.qrCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlan || !company?.id) return

    setLoading(true)
    const backendPlanCode = ({ basico: 'BASIC', profissional: 'PROFESSIONAL', empresarial: 'ENTERPRISE' } as Record<string, string>)[selectedPlan.key]

    if (paymentMethod === 'pix') {
      try {
        const res = await api.post(`/companies/${company.id}/billing/create-payment`, {
          plan: backendPlanCode,
          paymentMethod: 'pix',
        })
        setPaymentResult(res.data)
      } catch (err: any) {
        alert(err.response?.data?.message || 'Erro ao gerar pagamento Pix.')
      } finally {
        setLoading(false)
      }
    } else {
      // Credit Card Flow
      if (!window.MercadoPago) {
        alert('Carregando processador de pagamentos, por favor aguarde um momento.')
        setLoading(false)
        return
      }

      try {
        const mp = new window.MercadoPago(MP_PUBLIC_KEY)
        
        // Parse expiry
        const [expMonth, expYear] = cardInputs.expirationDate.split('/')
        if (!expMonth || !expYear) {
          alert('Por favor, informe a validade no formato MM/AA')
          setLoading(false)
          return
        }

        const cleanCardNumber = cardInputs.cardNumber.replace(/\s+/g, '')

        // Guess payment method ID
        let paymentMethodId = 'master'
        if (cleanCardNumber.startsWith('4')) paymentMethodId = 'visa'
        else if (cleanCardNumber.startsWith('3')) paymentMethodId = 'amex'
        else if (cleanCardNumber.startsWith('6')) paymentMethodId = 'elo'

        const cardTokenResult = await mp.createCardToken({
          cardNumber: cleanCardNumber,
          cardholderName: cardInputs.cardholderName,
          cardExpirationMonth: expMonth.trim(),
          cardExpirationYear: '20' + expYear.trim(),
          securityCode: cardInputs.securityCode,
          identificationType: 'CPF',
          identificationNumber: cardInputs.docNumber.replace(/\D/g, ''),
        })

        if (!cardTokenResult.id) {
          throw new Error('Falha ao gerar token de pagamento do cartão. Verifique os dados digitados.')
        }

        const res = await api.post(`/companies/${company.id}/billing/create-payment`, {
          plan: backendPlanCode,
          paymentMethod: 'credit_card',
          cardData: {
            token: cardTokenResult.id,
            paymentMethodId,
            email: company.email || 'financeiro@nexozap.com',
            identificationType: 'CPF',
            identificationNumber: cardInputs.docNumber.replace(/\D/g, ''),
          },
        })

        setPaymentResult(res.data)
        if (res.data.status === 'APPROVED') {
          if (company) {
            setCompany({ ...company, plan: res.data.plan })
          }
          fetchPlan()
        }
      } catch (err: any) {
        console.error(err)
        alert(err.message || 'Erro ao processar pagamento com cartão.')
      } finally {
        setLoading(false)
      }
    }
  }

  const currentPlan = plans[currentPlanKey]

  const usageItems = [
    {
      label: 'Atendimentos',
      icon: CalendarCheck,
      used: planLimits.appointments.used,
      max: planLimits.appointments.max,
    },
    {
      label: 'WhatsApp',
      icon: MessageSquare,
      used: planLimits.whatsapp.used,
      max: planLimits.whatsapp.max,
    },
    {
      label: 'Profissionais',
      icon: Users,
      used: planLimits.professionals.used,
      max: planLimits.professionals.max,
    },
  ]

  return (
    <div className="space-y-6">
      <Script 
        src="https://sdk.mercadopago.com/js/v2" 
        onLoad={() => setMpLoaded(true)}
      />

      {/* Grid de Planos Disponíveis */}
      {!selectedPlan && (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {Object.entries(plans).map(([key, details]) => {
              const isCurrent = key === currentPlanKey
              return (
                <div 
                  key={key} 
                  className={cn(
                    "flex flex-col rounded-2xl border bg-white p-6 shadow-sm relative transition-all duration-200",
                    isCurrent ? "border-purple-600 ring-2 ring-purple-600/10" : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-purple-600 px-3 py-1 text-xs font-semibold text-white">
                      Plano Atual
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{details.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-gray-500 text-sm">R$</span>
                    <span className="text-3xl font-extrabold text-gray-900">{details.price}</span>
                    <span className="text-gray-500 text-sm">/mês</span>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {details.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        {feature.included ? (
                          <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />
                        )}
                        <span className={cn(feature.included ? "text-gray-700" : "text-gray-400 line-through")}>
                          {feature.label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    disabled={isCurrent}
                    onClick={() => {
                      setSelectedPlan({ key, details })
                      setPaymentResult(null)
                    }}
                    className={cn(
                      "w-full rounded-xl py-3 text-center text-sm font-semibold transition-all",
                      isCurrent 
                        ? "bg-purple-50 text-purple-700 cursor-default" 
                        : "bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                    )}
                  >
                    {isCurrent ? 'Plano Ativo' : 'Assinar / Mudar'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Uso atual */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-900">Consumo da Franquia Atual ({currentPlan.name})</h3>
            <div className="space-y-4">
              {usageItems.map((item) => {
                const pct = item.max >= 99999 ? 0 : Math.min(100, (item.used / item.max) * 100)
                const displayMax = item.max >= 99999 ? '∞' : item.max

                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">{item.label}</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {item.used} / {displayMax}
                      </span>
                    </div>
                    {item.max < 99999 && (
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all',
                            pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-purple-600'
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Checkout Transparente Form */}
      {selectedPlan && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden max-w-2xl mx-auto">
          <div className="bg-gray-50 border-b border-gray-100 p-6 flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Checkout Seguro</span>
              <h2 className="text-lg font-bold text-gray-900">Assinatura - Plano {selectedPlan.details.name}</h2>
            </div>
            <button 
              onClick={() => setSelectedPlan(null)}
              className="text-gray-400 hover:text-gray-500 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>

          <div className="p-6">
            {!paymentResult ? (
              <form onSubmit={handleCheckoutSubmit} className="space-y-6">
                {/* Seleção do Meio de Pagamento */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Selecione a forma de pagamento</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pix')}
                      className={cn(
                        "flex flex-col items-center justify-center border-2 rounded-xl p-4 gap-2 transition-all",
                        paymentMethod === 'pix' 
                          ? "border-purple-600 bg-purple-50/30 text-purple-700" 
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      )}
                    >
                      <QrCode className="h-6 w-6" />
                      <span className="text-sm font-bold">Pix</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('credit_card')}
                      className={cn(
                        "flex flex-col items-center justify-center border-2 rounded-xl p-4 gap-2 transition-all",
                        paymentMethod === 'credit_card' 
                          ? "border-purple-600 bg-purple-50/30 text-purple-700" 
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      )}
                    >
                      <CreditCard className="h-6 w-6" />
                      <span className="text-sm font-bold">Cartão de Crédito</span>
                    </button>
                  </div>
                </div>

                {/* Formulário de Cartão de Crédito */}
                {paymentMethod === 'credit_card' && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Nome no Cartão</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: JOÃO SILVA"
                        value={cardInputs.cardholderName}
                        onChange={(e) => setCardInputs({...cardInputs, cardholderName: e.target.value})}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Número do Cartão</label>
                      <input
                        type="text"
                        required
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                        value={cardInputs.cardNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                          setCardInputs({...cardInputs, cardNumber: val});
                        }}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">Validade (MM/AA)</label>
                        <input
                          type="text"
                          required
                          placeholder="MM/AA"
                          maxLength={5}
                          value={cardInputs.expirationDate}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
                            setCardInputs({...cardInputs, expirationDate: val});
                          }}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">CVC / Código</label>
                        <input
                          type="password"
                          required
                          placeholder="123"
                          maxLength={4}
                          value={cardInputs.securityCode}
                          onChange={(e) => setCardInputs({...cardInputs, securityCode: e.target.value.replace(/\D/g, '')})}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">CPF do Titular</label>
                      <input
                        type="text"
                        required
                        placeholder="000.000.000-00"
                        maxLength={14}
                        value={cardInputs.docNumber}
                        onChange={(e) => {
                          const val = e.target.value
                            .replace(/\D/g, '')
                            .replace(/(\d{3})(\d)/, '$1.$2')
                            .replace(/(\d{3})(\d)/, '$1.$2')
                            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                          setCardInputs({...cardInputs, docNumber: val});
                        }}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                      />
                    </div>
                  </div>
                )}

                {/* Detalhes do resumo */}
                <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center text-sm border border-gray-100">
                  <span className="text-gray-600 font-medium">Total a pagar hoje:</span>
                  <span className="font-bold text-gray-900 text-lg">R$ {selectedPlan.details.price}</span>
                </div>

                {/* Botão submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-purple-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-purple-700 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Pagar Assinatura Segura
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Resultado do Pagamento */
              <div className="flex flex-col items-center text-center p-6 space-y-6">
                {paymentResult.status === 'APPROVED' ? (
                  <>
                    <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center border border-green-200">
                      <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Plano Ativado com Sucesso!</h3>
                      <p className="text-sm text-gray-500 mt-1">Sua empresa agora tem acesso total às regras do plano {selectedPlan.details.name}.</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPlan(null)
                        setPaymentResult(null)
                      }}
                      className="bg-gray-900 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-gray-800 transition-colors"
                    >
                      Voltar ao Painel
                    </button>
                  </>
                ) : (
                  /* Pix Pending */
                  <>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Escaneie o QR Code Pix</h3>
                      <p className="text-sm text-gray-500 mt-1">A sua assinatura será ativada assim que identificarmos o pagamento.</p>
                    </div>

                    {paymentResult.qrCodeBase64 && (
                      <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm flex items-center justify-center">
                        <img 
                          src={`data:image/png;base64,${paymentResult.qrCodeBase64}`} 
                          alt="Pix QR Code"
                          className="h-44 w-44 object-contain"
                        />
                      </div>
                    )}

                    <div className="w-full space-y-3">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wide">Código Pix Copia e Cola</label>
                        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-gray-50 max-w-md mx-auto">
                          <input
                            type="text"
                            readOnly
                            value={paymentResult.qrCode || ''}
                            className="bg-transparent px-4 py-2.5 text-xs text-gray-600 flex-1 truncate focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleCopyPix}
                            className="bg-white border-l border-gray-200 px-4 text-purple-600 font-semibold text-xs hover:bg-gray-50 flex items-center gap-1.5"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copied ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 animate-pulse">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
                      Aguardando confirmação de pagamento do banco...
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
