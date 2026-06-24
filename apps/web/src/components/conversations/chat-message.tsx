'use client';

import { cn } from '@/lib/utils';
import type { Message } from '@/app/(dashboard)/conversas/page';

interface ChatMessageProps {
  message: Message;
  showSender?: boolean;
}

export function ChatMessage({ message, showSender }: ChatMessageProps) {
  const isInbound = message.direction === 'INBOUND';
  const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'flex animate-in fade-in slide-in-from-bottom-1 duration-200',
        isInbound ? 'justify-start' : 'justify-end'
      )}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-xl px-4 py-2 shadow-sm',
          isInbound
            ? 'bg-gray-200 text-gray-900 rounded-bl-none'
            : 'bg-green-600 text-white rounded-br-none'
        )}
      >
        {showSender && message.senderName && (
          <p className={cn('text-xs font-medium mb-1', isInbound ? 'text-gray-600' : 'text-green-100')}>
            {message.senderName}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={cn(
            'text-[10px] mt-1 text-right',
            isInbound ? 'text-gray-500' : 'text-green-200'
          )}
        >
          {time}
        </p>
      </div>
    </div>
  );
}
