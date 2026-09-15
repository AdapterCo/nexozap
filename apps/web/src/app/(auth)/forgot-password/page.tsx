'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import api from '@/lib/api';

const emailSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

const resetSchema = z
  .object({
    password: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type EmailFormData = z.infer<typeof emailSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset' | 'success'>('email');
  const [token, setToken] = useState<string>('');
  const [emailValue, setEmailValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmitEmail = async (data: EmailFormData) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: data.email });
      setEmailValue(data.email);
      if (res.data?.resetToken) {
        setToken(res.data.resetToken);
        setStep('reset');
      } else {
        setStep('reset');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao processar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitReset = async (data: ResetFormData) => {
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        password: data.password,
      });
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível redefinir a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary-600">NexoZap</h1>
        <p className="text-gray-500 mt-2">Recuperação de Acesso</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={handleEmailSubmit(onSubmitEmail)} className="space-y-4">
          <p className="text-sm text-gray-600 mb-2">
            Digite seu e-mail cadastrado para redefinir sua senha de acesso.
          </p>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-mail cadastrado
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...registerEmail('email')}
                className="input-field pl-10"
                placeholder="seu@email.com"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
            {emailErrors.email && (
              <p className="mt-1 text-xs text-red-500">{emailErrors.email.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Validando...
              </>
            ) : (
              'Continuar'
            )}
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleResetSubmit(onSubmitReset)} className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg">
            Solicitação confirmada para <strong>{emailValue}</strong>. Digite sua nova senha abaixo.
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Nova Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...registerReset('password')}
                className="input-field pr-10"
                placeholder="No mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {resetErrors.password && (
              <p className="mt-1 text-xs text-red-500">{resetErrors.password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Nova Senha
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              {...registerReset('confirmPassword')}
              className="input-field"
              placeholder="Repita a nova senha"
            />
            {resetErrors.confirmPassword && (
              <p className="mt-1 text-xs text-red-500">{resetErrors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Alterando senha...
              </>
            ) : (
              'Salvar Nova Senha'
            )}
          </button>
        </form>
      )}

      {step === 'success' && (
        <div className="text-center py-4 space-y-4">
          <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Senha Alterada!</h3>
          <p className="text-sm text-gray-600">
            Sua senha foi redefinida com sucesso. Você já pode acessar sua conta.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Ir para o Login
          </button>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Voltar para o Login
        </Link>
      </div>
    </div>
  );
}
