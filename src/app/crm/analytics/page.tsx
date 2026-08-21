'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  Users, Target, FolderKanban, CheckSquare, TrendingUp, TrendingDown,
} from 'lucide-react'
import CrmCard from '@/components/crm/CrmCard'

interface AnalyticsData {
  totals: {
    clients: number
    leads: number
    deals: number
    tasks: number
    wonRevenue: number
    conversionRate: number
    completionRate: number
  }
  distributions: {
    clientStatus: { name: string; value: number }[]
    leadStatus: { name: string; value: number }[]
    dealStage: { name: string; value: number }[]
    taskStatus: { name: string; value: number }[]
  }
  revenueByMonth: { month: string; revenue: number; deals: number }[]
  topClients: { name: string; value: number; deals: number }[]
}

const statusColors: Record<string, string> = {
  active: '#10B981',
  inactive: '#6B7280',
  prospect: '#8B5CF6',
  new: '#8B5CF6',
  contacted: '#3B82F6',
  qualified: '#10B981',
  lost: '#EF4444',
  negotiation: '#3B82F6',
  proposal: '#F59E0B',
  won: '#10B981',
  todo: '#F59E0B',
  in_progress: '#3B82F6',
  done: '#10B981',
}

const stageLabels: Record<string, string> = {
  new: 'Новая',
  negotiation: 'Переговоры',
  proposal: 'Предложение',
  won: 'Выиграно',
  lost: 'Проиграно',
}

const leadLabels: Record<string, string> = {
  new: 'Новый',
  contacted: 'Связались',
  qualified: 'Квалифицирован',
  lost: 'Потерян',
}

const taskLabels: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Выполнено',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽'
}

function DistributionCard({
  title,
  data,
  labels,
}: {
  title: string
  data: { name: string; value: number }[]
  labels?: Record<string, string>
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <CrmCard className="p-5">
      <h2 className="font-crm-manrope text-[16px] font-semibold text-crm-text-primary mb-4">{title}</h2>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={statusColors[entry.name] ?? '#6B7280'} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F1525',
                border: '1px solid #1A2535',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#E8ECF1',
              }}
              formatter={(value, name) => [value ?? 0, (name && labels?.[name]) ?? (name ?? '')]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col items-center -mt-12 mb-2 relative z-10 pointer-events-none">
        <span className="font-crm-space text-[24px] font-bold text-crm-text-primary">{total}</span>
        <span className="text-[11px] text-crm-text-muted font-medium">всего</span>
      </div>
      <div className="space-y-2 mt-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusColors[item.name] ?? '#6B7280' }}
              />
              <span className="text-[13px] text-crm-text-secondary">{labels?.[item.name] ?? item.name}</span>
            </div>
            <span className="text-[14px] font-medium text-crm-text-primary">{item.value}</span>
          </div>
        ))}
      </div>
    </CrmCard>
  )
}

export default function CrmAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/crm/analytics')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm/analytics')
          return null
        }
        if (!res.ok) throw new Error('Ошибка загрузки аналитики')
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
        Не удалось загрузить аналитику
      </div>
    )
  }

  const { totals, distributions, revenueByMonth, topClients } = data

  const kpiCards = [
    {
      label: 'Всего клиентов',
      value: totals.clients,
      icon: Users,
      delta: '+5%',
      positive: true,
      accent: 'border-l-crm-accent',
    },
    {
      label: 'Конверсия лидов',
      value: `${totals.conversionRate}%`,
      icon: Target,
      delta: '+2%',
      positive: true,
      accent: 'border-l-crm-status-paid',
    },
    {
      label: 'Выручка (выиграно)',
      value: formatCurrency(totals.wonRevenue),
      icon: FolderKanban,
      delta: '-3%',
      positive: false,
      accent: 'border-l-crm-status-in-progress',
    },
    {
      label: 'Выполнение задач',
      value: `${totals.completionRate}%`,
      icon: CheckSquare,
      delta: '+8%',
      positive: true,
      accent: 'border-l-crm-status-pending',
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.06 }}
      >
        {kpiCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className={`bg-crm-bg-secondary border border-crm-border rounded-lg p-5 border-l-[4px] ${card.accent}`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] text-crm-text-secondary font-medium tracking-wide">{card.label}</p>
              <card.icon size={16} className="text-crm-text-muted" />
            </div>
            <p className="font-crm-space text-[28px] font-bold text-crm-text-primary leading-tight">
              {card.value}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {card.positive ? (
                <TrendingUp size={14} className="text-crm-status-paid" />
              ) : (
                <TrendingDown size={14} className="text-crm-status-unpaid" />
              )}
              <span className={`text-[13px] font-medium ${card.positive ? 'text-crm-status-paid' : 'text-crm-status-unpaid'}`}>
                {card.delta}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Revenue chart */}
      <CrmCard className="p-5">
        <h2 className="font-crm-manrope text-[16px] font-semibold text-crm-text-primary mb-1">
          Динамика выручки и количества сделок
        </h2>
        <p className="text-[12px] text-crm-text-secondary mb-4">По месяцам</p>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2535" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tick={{ fill: '#4A5568', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v))}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#4A5568', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F1525',
                  border: '1px solid #1A2535',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#E8ECF1',
                }}
                formatter={(value, name) =>
                  [name === 'revenue' ? formatCurrency(Number(value ?? 0)) : value ?? 0, name === 'revenue' ? 'Выручка' : 'Сделки']
                }
              />
              <Bar yAxisId="left" dataKey="revenue" fill="#4F6EF7" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="deals" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CrmCard>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DistributionCard title="Статусы клиентов" data={distributions.clientStatus} />
        <DistributionCard title="Стадии сделок" data={distributions.dealStage} labels={stageLabels} />
        <DistributionCard title="Статусы задач" data={distributions.taskStatus} labels={taskLabels} />
      </div>

      {/* Top clients */}
      <CrmCard className="p-5">
        <h2 className="font-crm-manrope text-[16px] font-semibold text-crm-text-primary mb-4">
          Топ клиентов по сумме сделок
        </h2>
        {topClients.length === 0 ? (
          <p className="text-sm text-crm-text-muted">Пока нет данных</p>
        ) : (
          <div className="space-y-3">
            {topClients.map((client, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-crm-bg-tertiary/50 rounded-md"
              >
                <div className="flex items-center gap-3">
                  <span className="text-crm-text-muted font-crm-space text-sm w-6">#{index + 1}</span>
                  <span className="text-crm-text-primary font-medium">{client.name}</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-sm text-crm-text-secondary">{client.deals} сделок</span>
                  <span className="font-crm-space text-[16px] font-semibold text-crm-text-primary">
                    {formatCurrency(client.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CrmCard>
    </div>
  )
}
