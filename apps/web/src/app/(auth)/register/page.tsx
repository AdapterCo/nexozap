'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  Loader2,
  Check,
  CreditCard,
  QrCode,
  Copy,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import useAuthStore from '@/stores/auth-store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    MercadoPago: any;
  }
}

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || '';
const POLLING_TIMEOUT_SECONDS = 180;
const POLLING_INTERVAL_MS = 3000;

const registerSchema = z
  .object({
    name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
    companyName: z.string().min(2, 'O nome da empresa deve ter pelo menos 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const plansList = [
  {
    code: 'BASIC',
    name: 'Essencial',
    price: '39,90',
    features: [
      'Agendamentos ilimitados',
      '1 número WhatsApp',
      '2 profissionais',
      '5 serviços cadastrados',
      'Relatórios básicos',
      'Lembretes automáticos',
    ],
  },
  {
    code: 'PROFESSIONAL',
    name: 'Profissional',
    price: '79,90',
    popular: true,
    features: [
      'Agendamentos ilimitados',
      '2 números WhatsApp',
      '10 profissionais',
      '20 serviços cadastrados',
      'Relatórios avançados',
      'Lembretes automáticos',
      'Assistente IA',
    ],
  },
  {
    code: 'ENTERPRISE',
    name: 'Empresarial',
    price: '119,90',
    features: [
      'Agendamentos ilimitados',
      'WhatsApp ilimitado',
      'Profissionais ilimitados',
      'Serviços ilimitados',
      'Relatórios completos',
      'Lembretes automáticos',
      'Assistente IA',
      'API de integração',
    ],
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, setAuthData } = useAuthStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form step 1 data
  const [formData, setFormData] = useState<RegisterFormData | null>(null);

  // Selected plan code
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('PROFESSIONAL');

  // Step 3 Payment State
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix'>('pix');
  const [loading, setLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Card Inputs
  const [cardInputs, setCardInputs] = useState({
    cardNumber: '',
    cardholderName: '',
    expirationDate: '',
    securityCode: '',
    docNumber: '',
  });

  // Polling states
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(POLLING_TIMEOUT_SECONDS);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollingIntervalRef.current = null;
    countdownIntervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  // Handle Step 1 Submit -> Advance to Step 2
  const onStep1Submit = (data: RegisterFormData) => {
    setFormData(data);
    setError(null);
    setStep(2);
  };

  // Start polling for Pix payment completion
  const startPixPolling = useCallback(
    (result: any) => {
      clearPolling();
      setTimeoutReached(false);
      setSecondsLeft(POLLING_TIMEOUT_SECONDS);

      countdownIntervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => Math.max(0, prev - 1));
      }, 1000);

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/auth/check-registration-payment/${result.paymentId}`);
          if (res.data?.status === 'APPROVED') {
            clearPolling();
            if (res.data.user && res.data.company) {
              setAuthData(res.data.user, res.data.company);
            }
            router.push('/dashboard');
          } else if (res.data?.status === 'CANCELLED' || res.data?.status === 'REJECTED') {
            clearPolling();
            setTimeoutReached(true);
            setPaymentResult(null);
          }
        } catch (err) {
          console.error('Erro no polling do cadastro:', err);
        }
      }, POLLING_INTERVAL_MS);

      timeoutRef.current = setTimeout(async () => {
        clearPolling();
        setTimeoutReached(true);
        try {
          await api.put(`/auth/cancel-registration-payment/${result.paymentId}`);
        } catch (err) {
          console.error('Erro ao cancelar cadastro por timeout:', err);
        }
        setPaymentResult(null);
      }, POLLING_TIMEOUT_SECONDS * 1000);
    },
    [clearPolling, router, setAuthData]
  );

  // Handle Final Payment Submit
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !selectedPlanCode) return;

    setError(null);
    setLoading(true);
    setTimeoutReached(false);

    try {
      if (paymentMethod === 'pix') {
        const result = await registerUser({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          companyName: formData.companyName,
          plan: selectedPlanCode,
          paymentMethod: 'pix',
        });

        if (result?.paymentId) {
          setPaymentResult(result);
          startPixPolling(result);
        } else if (result?.token) {
          router.push('/dashboard');
        }
      } else {
        // Credit card flow
        if (!window.MercadoPago) {
          alert('Carregando sistema de pagamentos... Aguarde um instante.');
          setLoading(false);
          return;
        }

        const mp = new window.MercadoPago(MP_PUBLIC_KEY);

        const [expMonth, expYear] = cardInputs.expirationDate.split('/');
        if (!expMonth || !expYear) {
          alert('Informe a validade no formato MM/AA');
          setLoading(false);
          return;
        }

        const cleanCardNumber = cardInputs.cardNumber.replace(/\s+/g, '');
        let paymentMethodId = 'master';
        if (cleanCardNumber.startsWith('4')) paymentMethodId = 'visa';
        else if (cleanCardNumber.startsWith('3')) paymentMethodId = 'amex';
        else if (cleanCardNumber.startsWith('6')) paymentMethodId = 'elo';

        const cardTokenResult = await mp.createCardToken({
          cardNumber: cleanCardNumber,
          cardholderName: cardInputs.cardholderName,
          cardExpirationMonth: expMonth.trim(),
          cardExpirationYear: '20' + expYear.trim(),
          securityCode: cardInputs.securityCode,
          identificationType: 'CPF',
          identificationNumber: cardInputs.docNumber.replace(/\D/g, ''),
        });

        if (!cardTokenResult.id) {
          throw new Error('Falha ao gerar token do cartão. Verifique os dados fornecidos.');
        }

        const result = await registerUser({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          companyName: formData.companyName,
          plan: selectedPlanCode,
          paymentMethod: 'credit_card',
          cardData: {
            token: cardTokenResult.id,
            paymentMethodId,
            email: formData.email,
            identificationType: 'CPF',
            identificationNumber: cardInputs.docNumber.replace(/\D/g, ''),
          },
        });

        if (result?.token) {
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao processar assinatura e criar conta.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (!paymentResult?.qrCode) return;
    navigator.clipboard.writeText(paymentResult.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedPlanDetails = plansList.find((p) => p.code === selectedPlanCode) || plansList[1];

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-2xl mx-auto w-full">
      <Script src="https://sdk.mercadopago.com/js/v2" />

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-extrabold text-purple-700 tracking-tight">NexoZap</h1>
        <p className="text-gray-500 text-sm mt-1">Crie sua conta e escolha seu plano para começar</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              step === 1 ? 'bg-purple-600 text-white ring-4 ring-purple-100' : 'bg-purple-100 text-purple-700'
            )}
          >
            1
          </div>
          <span className="text-xs font-medium text-gray-600 hidden sm:inline">Cadastro</span>
        </div>

        <div className="w-12 h-0.5 bg-gray-200 mx-2" />

        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              step === 2 ? 'bg-purple-600 text-white ring-4 ring-purple-100' : step > 2 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'
            )}
          >
            2
          </div>
          <span className="text-xs font-medium text-gray-600 hidden sm:inline">Plano</span>
        </div>

        <div className="w-12 h-0.5 bg-gray-200 mx-2" />

        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              step === 3 ? 'bg-purple-600 text-white ring-4 ring-purple-100' : 'bg-gray-100 text-gray-400'
            )}
          >
            3
          </div>
          <span className="text-xs font-medium text-gray-600 hidden sm:inline">Pagamento</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* PASSO 1: Dados Cadastrais */}
      {step === 1 && (
        <form onSubmit={handleSubmit(onStep1Submit)} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome completo
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              {...register('name')}
              className="input-field"
              placeholder="Seu nome"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
              Nome da empresa
            </label>
            <input
              id="companyName"
              type="text"
              autoComplete="organization"
              {...register('companyName')}
              className="input-field"
              placeholder="Sua empresa"
            />
            {errors.companyName && <p className="mt-1 text-xs text-red-500">{errors.companyName.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="input-field"
              placeholder="seu@email.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                className="input-field pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('confirmPassword')}
              className="input-field"
              placeholder="••••••••"
            />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-3 font-semibold text-sm shadow-md transition-all mt-4"
          >
            Avançar para Seleção do Plano
          </button>
        </form>
      )}

      {/* PASSO 2: Seleção de Plano */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-gray-500 hover:text-purple-600 flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar aos dados
            </button>
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
              Selecione o plano desejado
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {plansList.map((plan) => {
              const isSelected = selectedPlanCode === plan.code;
              return (
                <div
                  key={plan.code}
                  onClick={() => setSelectedPlanCode(plan.code)}
                  className={cn(
                    'cursor-pointer rounded-2xl border p-5 transition-all relative flex flex-col sm:flex-row sm:items-center justify-between gap-4',
                    isSelected
                      ? 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-600/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 right-4 bg-purple-600 text-white text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                      Mais Escolhido
                    </span>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {plan.name}
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-purple-600" />}
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {plan.features.slice(0, 4).map((f, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-right sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="text-gray-500 text-xs">R$</span>
                      <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                      <span className="text-gray-500 text-xs">/mês</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setStep(3)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-3 font-semibold text-sm shadow-md transition-all mt-4"
          >
            Avançar para Pagamento do Plano {selectedPlanDetails.name} (R$ {selectedPlanDetails.price})
          </button>
        </div>
      )}

      {/* PASSO 3: Pagamento Segurado */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                clearPolling();
                setPaymentResult(null);
                setTimeoutReached(false);
                setStep(2);
              }}
              className="text-xs font-semibold text-gray-500 hover:text-purple-600 flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Trocar Plano
            </button>
            <div className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Checkout Seguro
            </div>
          </div>

          {/* Estado de timeout */}
          {timeoutReached && (
            <div className="flex flex-col items-center text-center p-6 space-y-4 bg-red-50/50 rounded-2xl border border-red-100">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">Pagamento não identificado</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Não recebemos a confirmação do pagamento no prazo de 3 minutos. O cadastro não foi concluído.
                </p>
              </div>
              <button
                onClick={() => {
                  setTimeoutReached(false);
                  setPaymentResult(null);
                }}
                className="bg-purple-600 text-white rounded-xl px-6 py-2.5 text-xs font-semibold hover:bg-purple-700 transition-colors shadow-sm"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Form / QR Code display */}
          {!paymentResult && !timeoutReached && (
            <form onSubmit={handlePaymentSubmit} className="space-y-6">
              {/* Seleção do Meio de Pagamento */}
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={cn(
                      'flex flex-col items-center justify-center border-2 rounded-xl p-4 gap-2 transition-all',
                      paymentMethod === 'pix'
                        ? 'border-purple-600 bg-purple-50/40 text-purple-700 font-bold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    <QrCode className="h-6 w-6" />
                    <span className="text-sm">Pix (Ativação Instantânea)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit_card')}
                    className={cn(
                      'flex flex-col items-center justify-center border-2 rounded-xl p-4 gap-2 transition-all',
                      paymentMethod === 'credit_card'
                        ? 'border-purple-600 bg-purple-50/40 text-purple-700 font-bold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    <CreditCard className="h-6 w-6" />
                    <span className="text-sm">Cartão de Crédito</span>
                  </button>
                </div>
              </div>

              {/* Form de Cartão */}
              {paymentMethod === 'credit_card' && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                      Nome no Cartão
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: JOÃO SILVA"
                      value={cardInputs.cardholderName}
                      onChange={(e) => setCardInputs({ ...cardInputs, cardholderName: e.target.value })}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                      Número do Cartão
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                      value={cardInputs.cardNumber}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/\D/g, '')
                          .replace(/(.{4})/g, '$1 ')
                          .trim();
                        setCardInputs({ ...cardInputs, cardNumber: val });
                      }}
                      className="input-field"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                        Validade (MM/AA)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="MM/AA"
                        maxLength={5}
                        value={cardInputs.expirationDate}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
                          setCardInputs({ ...cardInputs, expirationDate: val });
                        }}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                        CVC / Código
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="123"
                        maxLength={4}
                        value={cardInputs.securityCode}
                        onChange={(e) => setCardInputs({ ...cardInputs, securityCode: e.target.value.replace(/\D/g, '') })}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                      CPF do Titular
                    </label>
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
                        setCardInputs({ ...cardInputs, docNumber: val });
                      }}
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              {/* Resumo do Valor */}
              <div className="bg-purple-50/60 rounded-xl p-4 flex justify-between items-center text-sm border border-purple-100">
                <div>
                  <span className="text-xs font-semibold text-purple-700 block">Plano Selecionado:</span>
                  <span className="font-bold text-gray-900">{selectedPlanDetails.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-purple-700 block">Total a pagar:</span>
                  <span className="font-extrabold text-gray-900 text-lg">R$ {selectedPlanDetails.price} /mês</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white rounded-xl py-3.5 font-bold text-sm hover:bg-purple-700 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando pagamento...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Pagar R$ {selectedPlanDetails.price} e Criar Minha Conta
                  </>
                )}
              </button>
            </form>
          )}

          {/* Resultado Pix Pending */}
          {paymentResult && !timeoutReached && (
            <div className="flex flex-col items-center text-center p-4 space-y-5 bg-white">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Escaneie o QR Code Pix</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Sua conta será criada e ativada automaticamente assim que o pagamento for confirmado.
                </p>
              </div>

              {paymentResult.qrCodeBase64 && (
                <div className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm flex items-center justify-center">
                  <img
                    src={`data:image/png;base64,${paymentResult.qrCodeBase64}`}
                    alt="Pix QR Code"
                    className="h-44 w-44 object-contain"
                  />
                </div>
              )}

              <div className="w-full space-y-2 max-w-md mx-auto">
                <label className="text-[11px] font-bold text-gray-500 block uppercase tracking-wide">
                  Código Pix Copia e Cola
                </label>
                <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                  <input
                    type="text"
                    readOnly
                    value={paymentResult.qrCode || ''}
                    className="bg-transparent px-3 py-2.5 text-xs text-gray-600 flex-1 truncate focus:outline-none"
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

              {/* Countdown Bar */}
              <div className="w-full max-w-md space-y-2 pt-2">
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-1000',
                      secondsLeft > 60 ? 'bg-purple-600' : secondsLeft > 30 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${(secondsLeft / POLLING_TIMEOUT_SECONDS) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1.5 animate-pulse text-purple-700 font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
                    Aguardando confirmação do Pix...
                  </div>
                  <div className="flex items-center gap-1 font-mono font-bold text-gray-700">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    {formatCountdown(secondsLeft)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-gray-500">
        Já possui uma conta ativa?{' '}
        <Link href="/login" className="text-purple-600 font-semibold hover:text-purple-700">
          Entrar no Painel
        </Link>
      </p>
    </div>
  );
}
