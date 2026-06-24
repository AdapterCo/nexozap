'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  MessageSquare,
  TrendingUp,
  Clock,
  Users,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import useAuthStore from '@/stores/auth-store';
import api from '@/lib/api';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DashboardStats {
  totalAppointments: number;
  todayAppointments: number;
  activeConversations: number;
  conversionRate: number;
}

interface ChartData {
  day: string;
  agendamentos: number;
  concluidos: number;
}

interface PopularService {
  name: string;
  value: number;
}

interface ScheduleItem {
  id: string;
  clientName: string;
  serviceName: string;
  time: string;
  status: string;
}

interface ConversationItem {
  id: string;
  clientName: string;
  lastMessage: string;
  status: string;
  time: string;
}

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardPage() {
  const { user, company } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weeklyData, setWeeklyData] = useState<ChartData[]>([]);
  const [popularServices, setPopularServices] = useState<PopularService[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [activeConversations, setActiveConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) return;

    const fetchData = async () => {
      try {
        const [statsRes, chartsRes] = await Promise.all([
          api.get(`/dashboard/${company.id}/stats`),
          api.get(`/charts/${company.id}`),
        ]);

        setStats(statsRes.data);
        setWeeklyData(chartsRes.data.weekly || []);
        setPopularServices(chartsRes.data.popularServices || []);
        setTodaySchedule(chartsRes.data.todaySchedule || []);
        setActiveConversations(chartsRes.data.activeConversations || []);
      } catch {
        setStats({
          totalAppointments: 0,
          todayAppointments: 0,
          activeConversations: 0,
          conversionRate: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [company?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total de Agendamentos',
      value: stats?.totalAppointments ?? 0,
      icon: CalendarCheck,
      color: 'bg-primary-50 text-primary-600',
    },
    {
      label: 'Hoje',
      value: stats?.todayAppointments ?? 0,
      icon: Calendar,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Conversas Ativas',
      value: stats?.activeConversations ?? 0,
      icon: MessageSquare,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Taxa de Conversão',
      value: `${stats?.conversionRate ?? 0}%`,
      icon: TrendingUp,
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Olá, {user?.name?.split(' ')[0] || 'Usuário'} 👋
        </h2>
        <p className="text-gray-500 mt-1">Aqui está o resumo do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center gap-4">
              <div className={cn('p-3 rounded-xl', card.color)}>
                <card.icon size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Agendamentos — Últimos 7 dias
          </h3>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="agendamentos" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="concluidos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              Sem dados para exibir
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Serviços Populares
          </h3>
          {popularServices.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={popularServices}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {popularServices.map((_, index) => (
                    <Cell
                      key={index}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              Sem dados para exibir
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">
              Agenda de Hoje
            </h3>
          </div>
          {todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {todaySchedule.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                      {item.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.clientName}
                      </p>
                      <p className="text-xs text-gray-500">{item.serviceName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{item.time}</p>
                    <span className={cn('badge text-[10px]', getStatusColor(item.status))}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Calendar size={32} className="mb-2" />
              <p className="text-sm">Nenhum agendamento para hoje</p>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">
              Conversas Ativas
            </h3>
          </div>
          {activeConversations.length > 0 ? (
            <div className="space-y-3">
              {activeConversations.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                      {item.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {item.clientName}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">
                        {item.lastMessage}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">{item.time}</p>
                    <span className={cn('badge text-[10px]', getStatusColor(item.status))}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Users size={32} className="mb-2" />
              <p className="text-sm">Nenhuma conversa ativa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
