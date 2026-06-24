'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { MessageSquare, Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface WhatsAppStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  phone?: string;
  instanceName?: string;
  qrCode?: string;
}

export default function WhatsAppPage() {
  const { token } = useAuthStore();
  const [status, setStatus] = useState<WhatsAppStatus>({ status: 'DISCONNECTED' });
  const [instanceName, setInstanceName] = useState('');
  const [showInstanceInput, setShowInstanceInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const response = await api.get('/whatsapp/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus(response.data);
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    }
  }, [token]);

  const fetchQrCode = useCallback(async () => {
    try {
      const response = await api.get('/whatsapp/qrcode', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus((prev) => ({ ...prev, qrCode: response.data.qrCode }));
    } catch (err) {
      console.error('Erro ao buscar QR Code:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (status.status === 'RECONNECTING') {
      const interval = setInterval(fetchQrCode, 5000);
      fetchQrCode();
      return () => clearInterval(interval);
    }
  }, [status.status, fetchQrCode]);

  const handleConnect = async () => {
    if (!instanceName.trim()) {
      setError('Digite o nome da instância');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post(
        '/whatsapp/connect',
        { instanceName: instanceName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus((prev) => ({ ...prev, status: 'RECONNECTING', instanceName: instanceName.trim() }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao conectar');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.post(
        '/whatsapp/disconnect',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus({ status: 'DISCONNECTED' });
      setInstanceName('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao desconectar');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'CONNECTED':
        return 'bg-green-500';
      case 'RECONNECTING':
        return 'bg-yellow-500';
      default:
        return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'CONNECTED':
        return 'Conectado';
      case 'RECONNECTING':
        return 'Reconectando';
      default:
        return 'Desconectado';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="h-8 w-8 text-green-600" />
        <h1 className="text-3xl font-bold">WhatsApp</h1>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Status da Conexão</h2>
          {status.status === 'CONNECTED' && (
            <div className="flex items-center gap-2 text-green-600">
              <Wifi className="h-5 w-5" />
              <span className="font-medium">Online</span>
            </div>
          )}
          {status.status === 'DISCONNECTED' && (
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
              getStatusColor(),
              status.status === 'RECONNECTING' && 'animate-pulse'
            )}
          />
          <p className="text-2xl font-bold mb-2">{getStatusText()}</p>

          {status.status === 'CONNECTED' && status.phone && (
            <p className="text-gray-600 mb-1">Telefone: {status.phone}</p>
          )}
          {status.instanceName && (
            <p className="text-gray-500 text-sm">Instância: {status.instanceName}</p>
          )}

          {status.status === 'RECONNECTING' && status.qrCode && (
            <div className="mt-6">
              <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block">
                <img
                  src={status.qrCode}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 object-contain"
                />
              </div>
              <p className="text-center text-gray-500 mt-3">
                Escaneie o QR Code com seu WhatsApp para conectar
              </p>
              <div className="flex items-center justify-center gap-2 mt-2 text-yellow-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Aguardando leitura...</span>
              </div>
            </div>
          )}

          {status.status === 'DISCONNECTED' && (
            <div className="mt-6 w-full max-w-sm">
              {showInstanceInput ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nome da instância"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleConnect}
                      disabled={loading}
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Conectando...' : 'Conectar'}
                    </button>
                    <button
                      onClick={() => {
                        setShowInstanceInput(false);
                        setInstanceName('');
                        setError('');
                      }}
                      className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowInstanceInput(true)}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Conectar
                </button>
              )}
            </div>
          )}

          {status.status === 'CONNECTED' && (
            <div className="mt-6">
              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
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
