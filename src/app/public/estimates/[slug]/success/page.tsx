import Link from 'next/link'

export default function PublicEstimateSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="max-w-md rounded-lg bg-white p-6 text-center shadow dark:bg-gray-800">
        <div className="mb-4 text-4xl">✅</div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Спасибо за оплату!</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Платёж принят. Исполнитель свяжется с вами для подтверждения деталей.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600"
        >
          На главную
        </Link>
      </div>
    </main>
  )
}
