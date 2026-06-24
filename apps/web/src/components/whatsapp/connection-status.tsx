'use client';

import { cn } from '@/lib/utils';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionStatusProps {
  status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  lastConnected?: string;
}

export function ConnectionStatus({ status, lastConnected }: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'CONNECTED':
        return 'bg-green-500';
      case 'RECONNECTING':
        return 'bg-yellow-500';
      default:
        return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'CONNECTED':
        return 'Conectado';
      case 'RECONNECTING':
        return 'Reconectando';
      default:
        return 'Desconectado';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'CONNECTED':
        return <Wifi className="h-5 w-5 text-green-600" />;
      case 'RECONNECTING':
        return <RefreshCw className="h-5 w-5 text-yellow-600 animate-spin" />;
      default:
        return <WifiOff className="h-5 w-5 text-red-600" />;
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'w-4 h-4 rounded-full',
          getStatusColor(),
          status === 'RECONNECTING' && 'animate-pulse'
        )}
      />
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>
      {lastConnected && status === 'CONNECTED' && (
        <span className="text-sm text-gray-500">
          Última conexão: {new Date(lastConnected).toLocaleString('pt-BR')}
        </span>
      )}
    </div>
  );
}
