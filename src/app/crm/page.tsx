import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import CheckRemindersButton from './CheckRemindersButton'

export default async function CrmPage() {
  const session = await auth()
  const user = session?.user

  if (!user?.id) {
    redirect('/login?callbackUrl=/crm')
  }

  const [clientsCount, leadsCount, dealsCount, tasksCount, eventsCount] = await Promise.all([
    prisma.crmClient.count({ where: { userId: user.id } }),
    prisma.crmLead.count({ where: { userId: user.id } }),
    prisma.crmDeal.count({ where: { userId: user.id } }),
    prisma.crmTask.count({ where: { userId: user.id } }),
    prisma.crmCalendarEvent.count({ where: { userId: user.id } }),
  ])

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              CRM
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Управление клиентами, лидами и сделками
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Вернуться в меню
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CrmCard
            title="Клиенты"
            count={clientsCount}
            href="/crm/clients"
            label="Перейти к клиентам"
          />
          <CrmCard
            title="Лиды"
            count={leadsCount}
            href="/crm/leads"
            label="Перейти к лидам"
          />
          <CrmCard
            title="Сделки"
            count={dealsCount}
            href="/crm/deals"
            label="Перейти к сделкам"
          />
          <CrmCard
            title="Задачи"
            count={tasksCount}
            href="/crm/tasks"
            label="Перейти к задачам"
          />
          <CrmCard
            title="Календарь"
            count={eventsCount}
            href="/crm/calendar"
            label="Открыть календарь"
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/crm/clients/new"
            className="flex items-center justify-center rounded-lg bg-blue-600 px-6 py-4 text-white hover:bg-blue-700"
          >
            + Добавить клиента
          </Link>
          <Link
            href="/crm/leads/new"
            className="flex items-center justify-center rounded-lg bg-green-600 px-6 py-4 text-white hover:bg-green-700"
          >
            + Добавить лида
          </Link>
          <Link
            href="/crm/deals/new"
            className="flex items-center justify-center rounded-lg bg-purple-600 px-6 py-4 text-white hover:bg-purple-700"
          >
            + Добавить сделку
          </Link>
          <Link
            href="/crm/tasks/new"
            className="flex items-center justify-center rounded-lg bg-orange-600 px-6 py-4 text-white hover:bg-orange-700"
          >
            + Добавить задачу
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/crm/activity"
            className="inline-block rounded-lg border border-gray-300 px-6 py-3 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            История активности
          </Link>
          <Link
            href="/crm/email-templates"
            className="inline-block rounded-lg border border-gray-300 px-6 py-3 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Шаблоны email
          </Link>
          <Link
            href="/crm/email-blast"
            className="inline-block rounded-lg border border-purple-300 bg-purple-50 px-6 py-3 text-sm text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30"
          >
            Массовая рассылка
          </Link>
          <CheckRemindersButton />
        </div>
      </div>
    </div>
  )
}

function CrmCard({
  title,
  count,
  href,
  label,
}: {
  title: string
  count: number
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
      <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
        {count}
      </p>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </Link>
  )
}
