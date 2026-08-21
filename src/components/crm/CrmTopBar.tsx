'use client'

import { usePathname } from 'next/navigation'
import { Search, Bell } from 'lucide-react'

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/crm': { title: 'Главная панель', subtitle: 'Обзор вашего бизнеса' },
  '/crm/clients': { title: 'Клиенты', subtitle: 'Управление клиентской базой' },
  '/crm/clients/new': { title: 'Новый клиент', subtitle: 'Добавление клиента' },
  '/crm/deals': { title: 'Сделки', subtitle: 'Управление сделками и проектами' },
  '/crm/deals/new': { title: 'Новая сделка', subtitle: 'Добавление сделки' },
  '/crm/analytics': { title: 'Аналитика', subtitle: 'Детальная статистика' },
  '/crm/leads': { title: 'Лиды', subtitle: 'Управление лидами' },
  '/crm/leads/new': { title: 'Новый лид', subtitle: 'Добавление лида' },
  '/crm/tasks': { title: 'Задачи', subtitle: 'Управление задачами' },
  '/crm/tasks/new': { title: 'Новая задача', subtitle: 'Добавление задачи' },
  '/crm/calendar': { title: 'Календарь', subtitle: 'События и встречи' },
  '/crm/funnel': { title: 'Воронка продаж', subtitle: 'Визуализация этапов' },
  '/crm/activity': { title: 'История активности', subtitle: 'Лента изменений' },
  '/crm/email-blast': { title: 'Массовая рассылка', subtitle: 'Отправка писем клиентам' },
  '/crm/email-templates': { title: 'Шаблоны email', subtitle: 'Управление шаблонами' },
}

export default function CrmTopBar() {
  const pathname = usePathname()
  const meta = pageMeta[pathname] || { title: 'InvoltCRM', subtitle: '' }

  return (
    <header className="h-16 bg-crm-bg-primary border-b border-crm-border flex items-center justify-between px-8 flex-shrink-0 relative z-10">
      {/* Left: Title */}
      <div>
        <h1 className="font-crm-manrope text-[28px] font-bold text-crm-text-primary leading-tight tracking-tight">
          {meta.title}
        </h1>
        {meta.subtitle && (
          <p className="text-[13px] text-crm-text-secondary leading-tight">{meta.subtitle}</p>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input
            type="text"
            placeholder="Поиск..."
            className="w-[280px] h-9 pl-9 pr-4 bg-crm-bg-primary border border-crm-border rounded-md text-sm text-crm-text-primary placeholder:text-crm-text-muted focus:outline-none focus:border-crm-accent focus:ring-[3px] focus:ring-crm-accent/15 transition-all"
          />
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-md text-crm-text-secondary hover:text-crm-text-primary hover:bg-crm-bg-tertiary/50 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-crm-accent rounded-full" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-crm-accent/20 border border-crm-accent/30 flex items-center justify-center text-crm-accent text-xs font-semibold cursor-pointer">
          АД
        </div>
      </div>
    </header>
  )
}
