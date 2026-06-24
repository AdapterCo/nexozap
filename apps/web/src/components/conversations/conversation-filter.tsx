'use client';

import { cn } from '@/lib/utils';
import type { ConversationFilterType } from '@/app/(dashboard)/conversas/page';

interface ConversationFilterProps {
  activeFilter: ConversationFilterType;
  onFilterChange: (filter: ConversationFilterType) => void;
  counts: Record<ConversationFilterType, number>;
}

const filters: { label: string; value: ConversationFilterType }[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Ativas', value: 'ACTIVE' },
  { label: 'IA', value: 'AI' },
  { label: 'Fluxo', value: 'FLOW' },
  { label: 'Humano', value: 'HUMAN' },
];

export function ConversationFilter({ activeFilter, onFilterChange, counts }: ConversationFilterProps) {
  return (
    <div className="flex items-center gap-1 bg-white rounded-lg shadow-sm p-1">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2',
            activeFilter === filter.value
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          {filter.label}
          {counts[filter.value] > 0 && (
            <span
              className={cn(
                'px-1.5 py-0.5 text-xs rounded-full',
                activeFilter === filter.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              )}
            >
              {counts[filter.value]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
