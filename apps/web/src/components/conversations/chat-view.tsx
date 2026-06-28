'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Send, MessageSquare } from 'lucide-react';
import { ChatMessage } from './chat-message';
import type { Conversation, Message } from '@/app/(dashboard)/conversas/page';

interface ChatViewProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string) => Promise<void>;
  onUpdateConversation?: (id: string, data: { mode?: 'AI' | 'FLOW' | 'HUMAN'; status?: 'ACTIVE' | 'ARCHIVED' }) => Promise<void>;
}

export function ChatView({ conversation, messages, onSendMessage, onUpdateConversation }: ChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!conversation) {
    return (
      <div className="bg-white rounded-xl shadow-md h-full flex flex-col items-center justify-center text-gray-500">
        <MessageSquare className="h-16 w-16 mb-4 text-gray-300" />
        <p className="text-lg">Selecione uma conversa</p>
      </div>
    );
  }

  const getModeBadge = (mode: string) => {
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
  };

  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage(inputValue.trim());
      setInputValue('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">
              {conversation.clientName?.charAt(0) || conversation.clientPhone?.slice(-2)}
            </span>
          </div>
          <div>
            <p className="font-medium">{conversation.clientName || conversation.clientPhone}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{conversation.clientPhone}</span>
              {getModeBadge(conversation.mode)}
            </div>
          </div>
        </div>

        {onUpdateConversation && (
          <div className="flex gap-2">
            {conversation.mode === 'HUMAN' ? (
              <>
                <button
                  onClick={() => onUpdateConversation(conversation.id, { mode: 'FLOW' })}
                  className="px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                >
                  Entregar para Fluxo
                </button>
                <button
                  onClick={() => onUpdateConversation(conversation.id, { mode: 'AI' })}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                  Entregar para IA
                </button>
              </>
            ) : (
              <button
                onClick={() => onUpdateConversation(conversation.id, { mode: 'HUMAN' })}
                className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200"
              >
                Assumir Controle Manual
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Nenhuma mensagem ainda</p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} showSender={conversation.mode === 'HUMAN'} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200">
        {conversation.mode !== 'HUMAN' ? (
          <div className="bg-gray-100 rounded-lg p-3 text-center text-sm text-gray-500">
            Atendimento automático
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || sending}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
