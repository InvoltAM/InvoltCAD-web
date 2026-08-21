'use client'

const statusColors: Record<string, string> = {
  active: '#10B981',
  inactive: '#6B7280',
  prospect: '#8B5CF6',
  pending: '#F59E0B',
  completed: '#10B981',
  cancelled: '#EF4444',
  in_progress: '#3B82F6',
  review: '#F59E0B',
  paid: '#10B981',
  unpaid: '#EF4444',
  partial: '#F59E0B',
  overpaid: '#4F6EF7',
}

const statusLabels: Record<string, string> = {
  active: 'Активен',
  inactive: 'Неактивен',
  prospect: 'Потенциальный',
  pending: 'В ожидании',
  completed: 'Выполнено',
  cancelled: 'Отменено',
  in_progress: 'В работе',
  review: 'На проверке',
  paid: 'Оплачено',
  unpaid: 'Не оплачено',
  partial: 'Частично',
  overpaid: 'Переплата',
}

interface CrmStatusBadgeProps {
  status: string
  label?: string
}

export default function CrmStatusBadge({ status, label }: CrmStatusBadgeProps) {
  const color = statusColors[status.toLowerCase()] ?? '#6B7280'
  const text = label ?? statusLabels[status.toLowerCase()] ?? status

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}4D`,
        color,
      }}
    >
      {text}
    </span>
  )
}
