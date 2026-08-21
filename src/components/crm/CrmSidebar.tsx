'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  BarChart3,
  Target,
  CheckSquare,
  Calendar,
  Filter,
  History,
  Mail,
  FileText,
} from 'lucide-react'

const mainNav = [
  { path: '/crm', label: 'Главная', icon: LayoutDashboard },
  { path: '/crm/clients', label: 'Клиенты', icon: Users },
  { path: '/crm/deals', label: 'Сделки', icon: FolderKanban },
  { path: '/crm/analytics', label: 'Аналитика', icon: BarChart3 },
]

const toolsNav = [
  { path: '/crm/leads', label: 'Лиды', icon: Target },
  { path: '/crm/tasks', label: 'Задачи', icon: CheckSquare },
  { path: '/crm/calendar', label: 'Календарь', icon: Calendar },
  { path: '/crm/funnel', label: 'Воронка', icon: Filter },
  { path: '/crm/activity', label: 'Активность', icon: History },
  { path: '/crm/email-blast', label: 'Рассылка', icon: Mail },
  { path: '/crm/email-templates', label: 'Шаблоны', icon: FileText },
]

function isActive(pathname: string, itemPath: string) {
  if (itemPath === '/crm') return pathname === '/crm'
  return pathname.startsWith(itemPath)
}

export default function CrmSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[240px] min-h-[100dvh] bg-crm-bg-secondary border-r border-crm-border flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-crm-border">
        <div className="w-7 h-7 rounded-lg bg-crm-accent/20 flex items-center justify-center text-crm-accent font-bold text-sm">
          IC
        </div>
        <span className="font-crm-manrope text-xl font-bold text-crm-accent tracking-tight">
          InvoltCRM
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {mainNav.map((item, index) => {
          const active = isActive(pathname, item.path)
          const Icon = item.icon
          return (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06, duration: 0.25, ease: 'easeOut' }}
            >
              <Link
                href={item.path}
                className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150
                  ${active
                    ? 'bg-crm-bg-tertiary text-crm-accent font-semibold border-l-[3px] border-l-crm-accent'
                    : 'text-crm-text-secondary hover:bg-crm-bg-tertiary/50 hover:text-crm-text-primary border-l-[3px] border-l-transparent'
                  }
                `}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                <span>{item.label}</span>
              </Link>
            </motion.div>
          )
        })}

        <div className="pt-4 pb-2 px-4">
          <p className="text-[11px] font-semibold text-crm-text-muted uppercase tracking-wider">
            Инструменты
          </p>
        </div>

        {toolsNav.map((item, index) => {
          const active = isActive(pathname, item.path)
          const Icon = item.icon
          return (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (mainNav.length + index) * 0.04, duration: 0.25, ease: 'easeOut' }}
            >
              <Link
                href={item.path}
                className={`
                  flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150
                  ${active
                    ? 'bg-crm-bg-tertiary text-crm-accent font-semibold border-l-[3px] border-l-crm-accent'
                    : 'text-crm-text-secondary hover:bg-crm-bg-tertiary/50 hover:text-crm-text-primary border-l-[3px] border-l-transparent'
                  }
                `}
              >
                <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                <span>{item.label}</span>
              </Link>
            </motion.div>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-5 py-4 border-t border-crm-border">
        <p className="text-[11px] text-crm-text-muted font-medium tracking-wide">
          InvoltCAD CRM
        </p>
      </div>
    </aside>
  )
}
