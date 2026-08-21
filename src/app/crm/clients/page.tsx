'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Phone, Mail, MoreVertical, Pencil, Trash2, X, Building2, Calendar } from 'lucide-react'
import CrmPageHeader from '@/components/crm/CrmPageHeader'
import CrmCard from '@/components/crm/CrmCard'
import CrmSearch from '@/components/crm/CrmSearch'
import CrmEmptyState from '@/components/crm/CrmEmptyState'
import CrmStatusBadge from '@/components/crm/CrmStatusBadge'
import CrmButton from '@/components/crm/CrmButton'

interface CrmClient {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  status: string
  createdAt: string
  projectCount?: number
  totalValue?: number
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽'
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
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

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    x: -60,
    transition: { duration: 0.25, ease: 'easeIn' as const },
  },
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<CrmClient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CrmClient | null>(null)

  useEffect(() => {
    fetch('/api/crm/clients')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm/clients')
          return null
        }
        if (!res.ok) throw new Error('Ошибка загрузки клиентов')
        return res.json()
      })
      .then((data: CrmClient[]) => {
        if (data) {
          setClients(data.map((c) => ({ ...c, projectCount: 0, totalValue: 0 })))
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (menuOpenId === null) return
    const handleClick = () => setMenuOpenId(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [menuOpenId])

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients
    const q = search.toLowerCase()
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
    )
  }, [clients, search])

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await fetch(`/api/crm/clients/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } else {
      alert('Не удалось удалить клиента')
    }
  }

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

  return (
    <div className="space-y-6">
      <CrmPageHeader title="Клиенты" count={clients.length} subtitle="Управление клиентской базой">
        <Link href="/crm/clients/new">
          <CrmButton icon={<Plus size={18} />}>Добавить клиента</CrmButton>
        </Link>
      </CrmPageHeader>

      <CrmSearch
        value={search}
        onChange={setSearch}
        placeholder="Поиск по имени, компании, телефону..."
        hint={`Всего: ${filteredClients.length} ${pluralize(filteredClients.length, 'клиент', 'клиента', 'клиентов')}`}
      />

      {clients.length === 0 && (
        <CrmEmptyState
          title="Пока нет клиентов"
          description="Добавьте первого клиента, чтобы начать работу"
          icon={<Search size={48} className="text-crm-text-muted" />}
          action={
            <Link href="/crm/clients/new">
              <CrmButton icon={<Plus size={18} />}>Добавить клиента</CrmButton>
            </Link>
          }
        />
      )}

      {clients.length > 0 && filteredClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search size={48} className="text-crm-text-muted mb-4" />
          <h3 className="font-crm-manrope text-base font-semibold text-crm-text-secondary mb-2">
            Ничего не найдено
          </h3>
          <p className="text-sm text-crm-text-muted">Попробуйте изменить поисковый запрос</p>
        </div>
      )}

      {filteredClients.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredClients.map((client) => (
              <motion.div
                key={client.id}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                onClick={() => router.push(`/crm/clients/${client.id}`)}
                className="group bg-crm-bg-secondary border border-crm-border rounded-lg p-5 cursor-pointer transition-all duration-250 hover:-translate-y-0.5 hover:border-crm-border-hover hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] min-h-[200px] flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-crm-bg-tertiary flex items-center justify-center text-crm-accent font-crm-manrope text-lg font-bold flex-shrink-0">
                      {getInitials(client.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-crm-manrope text-base font-semibold text-crm-text-primary leading-tight truncate">
                        {client.name}
                      </h3>
                      {client.company && (
                        <p className="text-[13px] text-crm-text-secondary truncate flex items-center gap-1 mt-0.5">
                          <Building2 size={12} className="flex-shrink-0" />
                          {client.company}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpenId(menuOpenId === client.id ? null : client.id)
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-crm-text-secondary hover:text-crm-text-primary hover:bg-crm-bg-tertiary/50 transition-colors"
                    >
                      <MoreVertical size={18} />
                    </button>
                    <AnimatePresence>
                      {menuOpenId === client.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.1 }}
                          className="absolute right-0 top-full mt-1 w-40 bg-crm-bg-elevated border border-crm-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.3)] z-50 py-1"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/crm/clients/${client.id}`)
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-crm-text-primary hover:bg-crm-bg-tertiary transition-colors"
                          >
                            <Pencil size={14} className="text-crm-text-secondary" />
                            Редактировать
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(client)
                              setMenuOpenId(null)
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-crm-status-unpaid hover:bg-crm-bg-tertiary transition-colors"
                          >
                            <Trash2 size={14} />
                            Удалить
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3 flex-1">
                  {client.phone && (
                    <div className="flex items-center gap-2 text-[13px] text-crm-text-secondary">
                      <Phone size={14} className="text-crm-text-muted flex-shrink-0" />
                      {client.phone}
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2 text-[13px] text-crm-text-secondary">
                      <Mail size={14} className="text-crm-text-muted flex-shrink-0" />
                      {client.email}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[12px] text-crm-text-muted">
                    <Calendar size={14} className="flex-shrink-0" />
                    {formatDate(client.createdAt)}
                  </div>
                </div>

                <div className="border-t border-crm-border my-3" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[13px]">
                    <CrmStatusBadge status={client.status} />
                    <span className="text-crm-text-secondary">
                      <span className="font-semibold">{client.projectCount ?? 0}</span> проектов
                    </span>
                  </div>
                  <span className="text-[13px] font-semibold text-crm-accent">
                    {formatCurrency(client.totalValue ?? 0)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(7, 10, 18, 0.75)', backdropFilter: 'blur(4px)' }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-crm-bg-elevated border border-crm-border rounded-xl w-full max-w-[400px] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.3)] text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-crm-status-unpaid/10 flex items-center justify-center">
                <Trash2 size={24} className="text-crm-status-unpaid" />
              </div>
              <h2 className="font-crm-manrope text-xl font-semibold text-crm-text-primary mb-2">
                Удалить клиента?
              </h2>
              <p className="text-sm text-crm-text-secondary mb-6">
                Клиент &ldquo;{deleteTarget.name}&rdquo; будет удалён. Это действие нельзя отменить.
              </p>
              <div className="flex items-center justify-center gap-3">
                <CrmButton variant="secondary" onClick={() => setDeleteTarget(null)}>
                  Отмена
                </CrmButton>
                <CrmButton variant="danger" onClick={handleDelete}>
                  Удалить
                </CrmButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
