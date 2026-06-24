'use client';

import { cn } from '@/lib/utils';
import { Phone, MessageSquare } from 'lucide-react';
import type { Conversation } from '@/app/(dashboard)/conversas/page';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  loading?: boolean;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'agora';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function getModeBadge(mode: string) {
  switch (mode) {
    case 'AI':
      return <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">IA</span>;
    case 'FLOW':
      return <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Fluxo</span>;
    case 'HUMAN':
      return <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">Humano</span>;
    default:
      return null;
  }
}

function getStatusDot(status: string) {
  return (
    <div
      className={cn(
        'w-2.5 h-2.5 rounded-full flex-shrink-0',
        status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
      )}
    />
  );
}

export function ConversationList({ conversations, selectedId, onSelect, loading }: ConversationListProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md h-full p-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-lg">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md h-full p-8 flex flex-col items-center justify-center text-gray-500">
        <MessageSquare className="h-12 w-12 mb-3 text-gray-300" />
        <p>Nenhuma conversa encontrada</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md h-full overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation)}
            className={cn(
              'w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-start gap-3',
              selectedId === conversation.id && 'bg-blue-50 border-l-4 border-l-blue-500'
            )}
          >
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
              <Phone className="h-4 w-4 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">
                  {conversation.clientName || conversation.clientPhone}
                </span>
                {getModeBadge(conversation.mode)}
                {getStatusDot(conversation.status)}
              </div>
              {conversation.lastMessage && (
                <p className="text-xs text-gray-500 truncate">{conversation.lastMessage}</p>
              )}
              {conversation.lastMessageTime && (
                <span className="text-xs text-gray-400">{timeAgo(conversation.lastMessageTime)}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
