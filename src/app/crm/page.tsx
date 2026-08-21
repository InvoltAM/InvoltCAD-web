import Link from 'next/link'

export default function CrmPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">CRM</h1>
        <p className="mb-8 text-lg text-gray-600 dark:text-gray-400">
          Управление клиентами и проектами
        </p>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Вернуться в меню
        </Link>
      </div>
    </div>
  )
}
