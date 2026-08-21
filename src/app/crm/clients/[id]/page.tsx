'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Building2, Phone, Mail, MapPin, Calendar, Send, FolderKanban, MessageSquare } from 'lucide-react'
import CrmCard from '@/components/crm/CrmCard'
import CrmButton from '@/components/crm/CrmButton'
import CrmStatusBadge from '@/components/crm/CrmStatusBadge'

interface CrmClient {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  telegramChatId: string | null
  address: string | null
  status: string
  source: string | null
  notes: string | null
  createdAt: string
}

interface CrmDeal {
  id: string
  title: string
  value: number
  stage: string
  createdAt: string
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [client, setClient] = useState<CrmClient | null>(null)
  const [deals, setDeals] = useState<CrmDeal[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string; updatedAt: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => {
      setId(id)
      Promise.all([
        fetch(`/api/crm/clients/${id}`).then((res) => {
          if (res.status === 401) {
            router.push(`/login?callbackUrl=/crm/clients/${id}`)
            return null
          }
          if (res.status === 404) throw new Error('Клиент не найден')
          if (!res.ok) throw new Error('Ошибка загрузки клиента')
          return res.json()
        }),
        fetch(`/api/crm/deals?clientId=${id}`).then((res) => (res.ok ? res.json() : [])),
        fetch('/api/projects')
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => (data ?? []).filter((p: { crmClientId?: string | null }) => p.crmClientId === id)),
      ])
        .then(([clientData, dealsData, projectsData]) => {
          if (clientData) setClient(clientData)
          setDeals(dealsData ?? [])
          setProjects(projectsData ?? [])
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    })
  }, [params, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-crm-status-unpaid text-center py-16">
        {error}
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-crm-text-secondary text-center py-16">
        Клиент не найден
      </div>
    )
  }

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0) / 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/crm/clients"
            className="w-9 h-9 flex items-center justify-center rounded-md text-crm-text-secondary hover:text-crm-text-primary hover:bg-crm-bg-tertiary/50 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="font-crm-manrope text-[28px] font-bold text-crm-text-primary tracking-tight leading-tight">
              {client.name}
            </h1>
            <p className="text-[13px] text-crm-text-secondary">Профиль клиента</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CrmButton variant="secondary" onClick={() => router.push(`/crm/clients/${client.id}/edit`)}>
            Редактировать
          </CrmButton>
          <Link href="/crm/deals/new">
            <CrmButton>+ Сделка</CrmButton>
          </Link>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CrmCard className="p-5" accent="border-l-crm-accent">
          <p className="text-[12px] text-crm-text-secondary font-medium tracking-wide">Сделок</p>
          <p className="font-crm-space text-[28px] font-bold text-crm-text-primary mt-1">{deals.length}</p>
        </CrmCard>
        <CrmCard className="p-5" accent="border-l-crm-status-paid">
          <p className="text-[12px] text-crm-text-secondary font-medium tracking-wide">Общая сумма</p>
          <p className="font-crm-space text-[28px] font-bold text-crm-text-primary mt-1">
            {totalValue.toLocaleString('ru-RU')} ₽
          </p>
        </CrmCard>
        <CrmCard className="p-5" accent="border-l-crm-status-in-progress">
          <p className="text-[12px] text-crm-text-secondary font-medium tracking-wide">Проектов</p>
          <p className="font-crm-space text-[28px] font-bold text-crm-text-primary mt-1">{projects.length}</p>
        </CrmCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Main info */}
        <CrmCard className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-crm-bg-tertiary flex items-center justify-center text-crm-accent font-crm-manrope text-2xl font-bold">
              {getInitials(client.name)}
            </div>
            <div>
              <h2 className="font-crm-manrope text-xl font-semibold text-crm-text-primary">{client.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <CrmStatusBadge status={client.status} />
                {client.company && (
                  <span className="text-[13px] text-crm-text-secondary flex items-center gap-1">
                    <Building2 size={12} /> {client.company}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {client.phone && (
              <div className="flex items-center gap-3 p-3 bg-crm-bg-tertiary/50 rounded-md">
                <Phone size={16} className="text-crm-text-muted" />
                <div>
                  <p className="text-[11px] text-crm-text-muted uppercase tracking-wide">Телефон</p>
                  <p className="text-sm text-crm-text-primary">{client.phone}</p>
                </div>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3 p-3 bg-crm-bg-tertiary/50 rounded-md">
                <Mail size={16} className="text-crm-text-muted" />
                <div>
                  <p className="text-[11px] text-crm-text-muted uppercase tracking-wide">Email</p>
                  <p className="text-sm text-crm-text-primary">{client.email}</p>
                </div>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-3 p-3 bg-crm-bg-tertiary/50 rounded-md">
                <MapPin size={16} className="text-crm-text-muted" />
                <div>
                  <p className="text-[11px] text-crm-text-muted uppercase tracking-wide">Адрес</p>
                  <p className="text-sm text-crm-text-primary">{client.address}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 bg-crm-bg-tertiary/50 rounded-md">
              <Calendar size={16} className="text-crm-text-muted" />
              <div>
                <p className="text-[11px] text-crm-text-muted uppercase tracking-wide">Добавлен</p>
                <p className="text-sm text-crm-text-primary">
                  {new Date(client.createdAt).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>
          </div>

          {client.notes && (
            <div className="mt-6">
              <h3 className="text-[13px] font-semibold text-crm-text-secondary mb-2">Примечания</h3>
              <p className="text-sm text-crm-text-primary whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </CrmCard>

        {/* Sidebar info */}
        <div className="space-y-4">
          <CrmCard className="p-5">
            <h3 className="font-crm-manrope text-base font-semibold text-crm-text-primary mb-4 flex items-center gap-2">
              <Send size={16} /> Telegram
            </h3>
            {client.telegramChatId ? (
              <div>
                <p className="text-[12px] text-crm-text-secondary mb-1">Chat ID</p>
                <p className="text-sm text-crm-text-primary font-mono">{client.telegramChatId}</p>
                <p className="text-[12px] text-crm-text-muted mt-3">
                  Чтобы отправить сообщение, перейдите в режим редактирования клиента.
                </p>
              </div>
            ) : (
              <p className="text-sm text-crm-text-muted">
                Telegram chat ID не указан. Добавьте его в редактировании клиента.
              </p>
            )}
          </CrmCard>

          <CrmCard className="p-5">
            <h3 className="font-crm-manrope text-base font-semibold text-crm-text-primary mb-4 flex items-center gap-2">
              <FolderKanban size={16} /> Связанные проекты
            </h3>
            {projects.length === 0 ? (
              <p className="text-sm text-crm-text-muted">Нет связанных проектов</p>
            ) : (
              <ul className="space-y-2">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-crm-bg-tertiary/50 rounded-md"
                  >
                    <span className="text-sm text-crm-text-primary font-medium">{p.name}</span>
                    <Link
                      href={`/editor?project=${p.id}`}
                      className="text-[12px] text-crm-accent hover:text-crm-accent-light"
                    >
                      Открыть
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CrmCard>
        </div>
      </div>

      {/* Deals */}
      <CrmCard className="p-5">
        <h3 className="font-crm-manrope text-base font-semibold text-crm-text-primary mb-4 flex items-center gap-2">
          <MessageSquare size={16} /> Сделки клиента
        </h3>
        {deals.length === 0 ? (
          <p className="text-sm text-crm-text-muted">Сделок пока нет</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-crm-bg-tertiary">
                <tr>
                  <th className="px-5 py-2.5 text-[12px] font-semibold text-crm-text-muted uppercase tracking-wider">Название</th>
                  <th className="px-5 py-2.5 text-[12px] font-semibold text-crm-text-muted uppercase tracking-wider">Сумма</th>
                  <th className="px-5 py-2.5 text-[12px] font-semibold text-crm-text-muted uppercase tracking-wider">Этап</th>
                  <th className="px-5 py-2.5 text-[12px] font-semibold text-crm-text-muted uppercase tracking-wider">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-border">
                {deals.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => router.push(`/crm/deals/${deal.id}`)}
                    className="cursor-pointer hover:bg-crm-bg-tertiary/30 transition-colors"
                  >
                    <td className="px-5 py-3 text-crm-text-primary font-medium">{deal.title}</td>
                    <td className="px-5 py-3 text-crm-text-primary font-crm-space">
                      {(deal.value / 100).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-5 py-3">
                      <CrmStatusBadge status={deal.stage} />
                    </td>
                    <td className="px-5 py-3 text-crm-text-secondary">
                      {new Date(deal.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CrmCard>
    </div>
  )
}

function getInitials(name: string): string {
  return name
    .split(/[\s"]+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
