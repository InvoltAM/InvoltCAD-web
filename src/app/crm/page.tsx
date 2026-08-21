'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown, ArrowRight,
  Plus, CreditCard, CheckCircle, AlertCircle, Edit,
  Users, Target, FolderKanban, CheckSquare, Calendar,
} from 'lucide-react'
import CrmCard from '@/components/crm/CrmCard'
import CrmStatusBadge from '@/components/crm/CrmStatusBadge'

interface DashboardData {
  counts: {
    clients: number
    leads: number
    deals: number
    tasks: number
    events: number
  }
  kpi: {
    totalRevenue: number
    totalDebt: number
    doneTasks: number
    overdueTasks: number
  }
  revenueByMonth: { month: string; revenue: number }[]
  dealsByStage: { name: string; value: number; color: string; stage: string }[]
  recentDeals: {
    id: string
    name: string
    client: string
    value: number
    stage: string
    createdAt: string
  }[]
  activity: {
    id: string
    type: string
    description: string
    date: string
  }[]
}

const stageLabels: Record<string, string> = {
  new: 'Новая',
  negotiation: 'Переговоры',
  proposal: 'Предложение',
  won: 'Выиграно',
  lost: 'Проиграно',
}

const stageColors: Record<string, string> = {
  new: '#8B5CF6',
  negotiation: '#3B82F6',
  proposal: '#F59E0B',
  won: '#10B981',
  lost: '#6B7280',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽'
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'create_deal': return { Icon: Plus, color: '#10B981' }
    case 'create_client': return { Icon: Users, color: '#4F6EF7' }
    case 'complete_task': return { Icon: CheckCircle, color: '#10B981' }
    case 'create_task': return { Icon: CheckSquare, color: '#F59E0B' }
    case 'create_event': return { Icon: Calendar, color: '#3B82F6' }
    case 'send_email': return { Icon: CreditCard, color: '#4F6EF7' }
    case 'update_deal_stage': return { Icon: Target, color: '#8B5CF6' }
    default: return { Icon: Edit, color: '#4F6EF7' }
  }
}

function timeAgo(date: string): string {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(hours / 24)

  if (hours < 1) return 'Только что'
  if (hours < 24) return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} назад`
  if (days === 1) return 'Вчера'
  return `${days} ${days < 5 ? 'дня' : 'дней'} назад`
}

function CustomRevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-crm-bg-elevated border border-crm-border rounded-md px-4 py-3 shadow-lg">
      <p className="text-crm-text-secondary text-[11px] font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-crm-text-primary text-lg font-crm-space font-semibold">
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function CrmDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/crm/dashboard')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm')
          return null
        }
        if (!res.ok) throw new Error('Ошибка загрузки dashboard')
        return res.json()
      })
      .then((json) => {
        if (json) setData(json)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-crm-text-secondary text-center py-16">
        Не удалось загрузить данные dashboard
      </div>
    )
  }

  const { counts, kpi, revenueByMonth, dealsByStage, recentDeals, activity } = data
  const totalProjects = dealsByStage.reduce((s, d) => s + d.value, 0)

  const kpiCards = [
    {
      label: 'Общая выручка',
      value: formatCurrency(kpi.totalRevenue),
      delta: '+12.5%',
      deltaText: 'за этот месяц',
      deltaPositive: true,
      accent: 'border-l-crm-accent',
    },
    {
      label: 'Активные сделки',
      value: String(counts.deals),
      delta: '+3',
      deltaText: 'новых этой недели',
      deltaPositive: true,
      accent: 'border-l-crm-status-in-progress',
    },
    {
      label: 'Ожидают оплаты',
      value: formatCurrency(kpi.totalDebt),
      delta: `${counts.deals} сделок`,
      deltaText: '',
      deltaPositive: false,
      accent: 'border-l-crm-status-unpaid',
    },
    {
      label: 'Выполнено задач',
      value: `${kpi.doneTasks}`,
      delta: '+4%',
      deltaText: 'vs прошлый месяц',
      deltaPositive: true,
      accent: 'border-l-crm-status-paid',
    },
  ]

  const quickLinks = [
    { href: '/crm/clients/new', label: 'Добавить клиента', icon: Users, color: 'bg-crm-accent' },
    { href: '/crm/leads/new', label: 'Добавить лида', icon: Target, color: 'bg-crm-status-pending' },
    { href: '/crm/deals/new', label: 'Добавить сделку', icon: FolderKanban, color: 'bg-crm-status-in-progress' },
    { href: '/crm/tasks/new', label: 'Добавить задачу', icon: CheckSquare, color: 'bg-crm-status-paid' },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {kpiCards.map((card, i) => (
          <motion.div
            key={i}
            variants={cardVariants}
            className={`bg-crm-bg-secondary border border-crm-border rounded-lg p-5 border-l-[4px] ${card.accent} cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-crm-border-hover hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]`}
          >
            <p className="text-[12px] text-crm-text-secondary font-medium tracking-wide mb-1">{card.label}</p>
            <p className="font-crm-space text-[36px] font-bold text-crm-text-primary leading-tight tracking-tight">
              {card.value}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {card.deltaPositive ? (
                <TrendingUp size={14} className="text-crm-status-paid" />
              ) : (
                <TrendingDown size={14} className="text-crm-status-unpaid" />
              )}
              <span className={`text-[13px] font-medium ${card.deltaPositive ? 'text-crm-status-paid' : 'text-crm-status-unpaid'}`}>
                {card.delta}
              </span>
              {card.deltaText && (
                <span className="text-[13px] text-crm-text-secondary">{card.deltaText}</span>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.18 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 px-4 py-3 bg-crm-bg-secondary border border-crm-border rounded-lg hover:border-crm-border-hover transition-colors"
          >
            <div className={`w-9 h-9 rounded-md ${link.color} bg-opacity-20 flex items-center justify-center text-white`}>
              <link.icon size={18} />
            </div>
            <span className="text-sm font-medium text-crm-text-primary">{link.label}</span>
          </Link>
        ))}
      </motion.div>

      {/* Row 2: Revenue Chart + Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.24 }}
          className="bg-crm-bg-secondary border border-crm-border rounded-lg p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-crm-manrope text-[16px] font-semibold text-crm-text-primary">Динамика сделок</h2>
              <p className="text-[12px] text-crm-text-secondary">По месяцам, ₽</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F6EF7" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#4F6EF7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2535" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: '#4A5568', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#4A5568', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000000
                    ? (v / 1000000).toFixed(1) + 'M'
                    : v >= 1000
                      ? (v / 1000).toFixed(0) + 'k'
                      : String(v)
                }
              />
              <Tooltip content={<CustomRevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#4F6EF7"
                strokeWidth={2.5}
                fill="url(#revenueGradient)"
                dot={{ r: 4, fill: '#0C1222', stroke: '#4F6EF7', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#4F6EF7', stroke: '#0C1222', strokeWidth: 2 }}
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Deals by Stage Doughnut */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-crm-bg-secondary border border-crm-border rounded-lg p-5"
        >
          <div className="mb-4">
            <h2 className="font-crm-manrope text-[16px] font-semibold text-crm-text-primary">Этапы сделок</h2>
            <p className="text-[12px] text-crm-text-secondary">Распределение по состоянию</p>
          </div>

          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={dealsByStage}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  animationBegin={200}
                  animationDuration={400}
                  animationEasing="ease-out"
                >
                  {dealsByStage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value ?? 0} проектов`, name]}
                  contentStyle={{
                    backgroundColor: '#0F1525',
                    border: '1px solid #1A2535',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#E8ECF1',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col items-center -mt-16 mb-3 relative z-10 pointer-events-none">
            <span className="font-crm-space text-[28px] font-bold text-crm-text-primary">{totalProjects}</span>
            <span className="text-[11px] text-crm-text-muted font-medium">сделок</span>
          </div>

          <div className="space-y-2 mt-1">
            {dealsByStage.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[13px] text-crm-text-secondary">{item.name}</span>
                </div>
                <span className="text-[14px] font-medium text-crm-text-primary">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Row 3: Recent Deals + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {/* Recent Deals Table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="bg-crm-bg-secondary border border-crm-border rounded-lg"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-crm-manrope text-[16px] font-semibold text-crm-text-primary">Последние сделки</h2>
            <Link
              href="/crm/deals"
              className="flex items-center gap-1 text-[13px] text-crm-text-secondary hover:text-crm-accent transition-colors group"
            >
              Все сделки
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-crm-bg-tertiary">
                  <th className="text-left px-5 py-2.5 text-[12px] font-semibold text-crm-text-muted uppercase tracking-wider">Сделка</th>
                  <th className="text-left px-5 py-2.5 text-[12px] font-semibold text-crm-text-muted uppercase tracking-wider">Клиент</th>
                  <th className="text-left px-5 py-2.5 text-[12px] font-semibold text-crm-text-muted uppercase tracking-wider">Сумма</th>
                  <th className="text-left px-5 py-2.5 text-[12px] font-semibold text-crm-text-muted uppercase tracking-wider">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-border">
                {recentDeals.map((project) => (
                  <tr
                    key={project.id}
                    onClick={() => router.push(`/crm/deals/${project.id}`)}
                    className="group cursor-pointer hover:bg-crm-bg-tertiary/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="text-[14px] font-medium text-crm-text-primary">{project.name}</p>
                      <p className="text-[12px] text-crm-text-secondary">{new Date(project.createdAt).toLocaleDateString('ru-RU')}</p>
                    </td>
                    <td className="px-5 py-3 text-[14px] text-crm-text-primary">
                      {project.client || '—'}
                    </td>
                    <td className="px-5 py-3 font-crm-space text-[16px] font-semibold text-crm-text-primary">
                      {formatCurrency(project.value)}
                    </td>
                    <td className="px-5 py-3">
                      <CrmStatusBadge status={project.stage} label={stageLabels[project.stage] ?? project.stage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="bg-crm-bg-secondary border border-crm-border rounded-lg p-5 max-h-[420px] overflow-y-auto"
        >
          <h2 className="font-crm-manrope text-[16px] font-semibold text-crm-text-primary mb-4">Недавняя активность</h2>
          <div className="space-y-1">
            {activity.length === 0 && (
              <p className="text-sm text-crm-text-muted">Пока нет активности</p>
            )}
            {activity.map((item, i) => {
              const { Icon, color } = getActivityIcon(item.type)
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.05, duration: 0.25, ease: 'easeOut' }}
                  className="flex items-start gap-3 p-2.5 rounded-md hover:bg-crm-bg-tertiary/30 transition-colors cursor-pointer"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-crm-text-muted font-medium">{timeAgo(item.date)}</p>
                    <p className="text-[13px] text-crm-text-secondary leading-snug mt-0.5">{item.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
