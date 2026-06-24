'use client';

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

interface ChartData {
  day: string;
  agendamentos: number;
  concluidos: number;
}

interface PopularService {
  name: string;
  value: number;
}

interface DashboardChartsProps {
  weeklyData: ChartData[];
  popularServices: PopularService[];
}

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardCharts({ weeklyData, popularServices }: DashboardChartsProps) {
  return (
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
  );
}
