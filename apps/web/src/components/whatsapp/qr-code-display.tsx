'use client';

import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

interface QrCodeDisplayProps {
  qrCode?: string;
  loading?: boolean;
}

export function QrCodeDisplay({ qrCode, loading }: QrCodeDisplayProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-64 h-64 bg-gray-100 rounded-xl border-2 border-gray-200 flex items-center justify-center">
          <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
        </div>
        <p className="text-sm text-gray-500">Carregando QR Code...</p>
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-64 h-64 bg-gray-100 rounded-xl border-2 border-gray-200 flex items-center justify-center">
          <p className="text-gray-400 text-sm text-center px-4">
            Aguardando QR Code...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block shadow-sm">
        <img
          src={qrCode}
          alt="QR Code WhatsApp"
          className="w-64 h-64 object-contain"
        />
      </div>
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />
        <p className="text-sm text-gray-600">Aguardando leitura...</p>
      </div>
    </div>
  );
}
