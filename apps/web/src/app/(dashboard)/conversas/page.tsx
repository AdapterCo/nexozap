'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';
import { ConversationList } from '@/components/conversations/conversation-list';
import { ChatView } from '@/components/conversations/chat-view';
import { ConversationFilter } from '@/components/conversations/conversation-filter';

export type ConversationFilterType = 'ALL' | 'ACTIVE' | 'AI' | 'FLOW' | 'HUMAN';

export interface Conversation {
  id: string;
  clientPhone: string;
  clientName?: string;
  mode: 'AI' | 'FLOW' | 'HUMAN';
  status: 'ACTIVE' | 'INACTIVE';
  lastMessage?: string;
  lastMessageTime?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderName?: string;
  createdAt: string;
}

export default function ConversasPage() {
  const { token } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<ConversationFilterType>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter === 'ACTIVE') params.append('status', 'ACTIVE');
      if (filter === 'AI') params.append('mode', 'AI');
      if (filter === 'FLOW') params.append('mode', 'FLOW');
      if (filter === 'HUMAN') params.append('mode', 'HUMAN');

      const response = await api.get(`/conversations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(response.data);
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await api.get(`/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(response.data);
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      const interval = setInterval(() => fetchMessages(selectedConversation.id), 10000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation, fetchMessages]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const getFilterCounts = () => {
    const counts = {
      ALL: conversations.length,
      ACTIVE: conversations.filter((c) => c.status === 'ACTIVE').length,
      AI: conversations.filter((c) => c.mode === 'AI').length,
      FLOW: conversations.filter((c) => c.mode === 'FLOW').length,
      HUMAN: conversations.filter((c) => c.mode === 'HUMAN').length,
    };
    return counts;
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Conversas</h1>
      </div>

      <ConversationFilter
        activeFilter={filter}
        onFilterChange={setFilter}
        counts={getFilterCounts()}
      />

      <div className="flex gap-4 mt-4 h-[calc(100%-8rem)]">
        <div className="w-96 flex-shrink-0">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversation?.id}
            onSelect={handleSelectConversation}
            loading={loading}
          />
        </div>
        <div className="flex-1">
          <ChatView
            conversation={selectedConversation}
            messages={messages}
            onSendMessage={async (content: string) => {
              if (!selectedConversation) return;
              try {
                await api.post(
                  `/conversations/${selectedConversation.id}/messages`,
                  { content },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                fetchMessages(selectedConversation.id);
                fetchConversations();
              } catch (err) {
                console.error('Erro ao enviar mensagem:', err);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
