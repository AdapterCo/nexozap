'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { MessageSquare, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface WhatsAppStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  phone?: string | null;
  instanceName?: string | null;
  qrCode?: string | null;
}

export default function WhatsAppPage() {
  const { company } = useAuthStore();
  const [status, setStatus] = useState<WhatsAppStatus>({ status: 'DISCONNECTED' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchQrCode = useCallback(async () => {
    if (!company?.id) return;

    const response = await api.get(`/companies/${company.id}/whatsapp/qrcode`);
    const qrCode = response.data.qrCode || null;

    setStatus((prev) => ({
      ...prev,
      qrCode,
      status: qrCode ? 'RECONNECTING' : prev.status,
    }));
  }, [company?.id]);

  const fetchStatus = useCallback(async () => {
    if (!company?.id) return;

    const response = await api.get(`/companies/${company.id}/whatsapp/status`);
    setStatus((prev) => ({
      ...prev,
      ...response.data,
      qrCode: response.data.qrCode || prev.qrCode || null,
    }));
  }, [company?.id]);

  useEffect(() => {
    fetchStatus().catch(() => undefined);
    const interval = window.setInterval(() => {
      fetchStatus().catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (status.status !== 'RECONNECTING') return;

    fetchQrCode().catch(() => undefined);
    const interval = window.setInterval(() => {
      fetchQrCode().catch(() => undefined);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [fetchQrCode, status.status]);

  const handleConnect = async () => {
    if (!company?.id) {
      setError('Empresa não carregada. Atualize a página e tente novamente.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post(`/companies/${company.id}/whatsapp/connect`);
      const data = response.data;

      // Usar QR Code retornado diretamente pela resposta do connect
      setStatus({
        status: data.status || 'RECONNECTING',
        phone: data.phone || null,
        qrCode: data.qrCode || null,
      });

      // Se não veio QR Code na resposta, buscar via polling
      if (!data.qrCode && data.status === 'RECONNECTING') {
        await fetchQrCode();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao iniciar conexão com WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!company?.id) return;

    setLoading(true);
    setError('');

    try {
      await api.delete(`/companies/${company.id}/whatsapp/disconnect`);
      setStatus({ status: 'DISCONNECTED', phone: null, qrCode: null });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao desconectar WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = {
    CONNECTED: 'bg-green-500',
    RECONNECTING: 'bg-yellow-500',
    DISCONNECTED: 'bg-red-500',
  }[status.status];

  const statusText = {
    CONNECTED: 'Conectado',
    RECONNECTING: 'Aguardando QR Code',
    DISCONNECTED: 'Desconectado',
  }[status.status];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="h-8 w-8 text-green-600" />
        <h1 className="text-3xl font-bold">WhatsApp</h1>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Status da Conexão</h2>
          {status.status === 'CONNECTED' ? (
            <div className="flex items-center gap-2 text-green-600">
              <Wifi className="h-5 w-5" />
              <span className="font-medium">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600">
              <WifiOff className="h-5 w-5" />
              <span className="font-medium">Offline</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center py-8">
          <div
            className={cn(
              'w-24 h-24 rounded-full mb-4',
              statusColor,
              status.status === 'RECONNECTING' && 'animate-pulse',
            )}
          />

          <p className="text-2xl font-bold mb-2">{statusText}</p>

          {status.status === 'CONNECTED' && status.phone && (
            <p className="text-gray-600 mb-1">Telefone: {status.phone}</p>
          )}

          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

          {status.status === 'RECONNECTING' && (
            <div className="mt-6 text-center">
              {status.qrCode ? (
                <>
                  <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block">
                    <img
                      src={status.qrCode}
                      alt="QR Code WhatsApp"
                      className="w-64 h-64 object-contain"
                    />
                  </div>
                  <p className="text-center text-gray-500 mt-3">
                    Escaneie o QR Code em WhatsApp &gt; Dispositivos conectados.
                  </p>
                </>
              ) : (
                <p className="text-gray-500">Gerando QR Code...</p>
              )}

              <div className="flex items-center justify-center gap-2 mt-3 text-yellow-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Aguardando conexão...</span>
              </div>
            </div>
          )}

          {status.status === 'DISCONNECTED' && (
            <div className="mt-6 w-full max-w-sm">
              <button
                onClick={handleConnect}
                disabled={loading || !company?.id}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Conectando...' : 'Conectar WhatsApp'}
              </button>
            </div>
          )}

          {status.status === 'CONNECTED' && (
            <div className="mt-6">
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="bg-red-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
