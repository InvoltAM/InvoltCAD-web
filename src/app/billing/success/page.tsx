export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md dark:bg-gray-800">
        <div className="mb-4 text-5xl text-green-500">✓</div>
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          Оплата прошла успешно
        </h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Ваш тариф или кредиты будут активированы в ближайшие минуты.
        </p>
        <a
          href="/editor"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Перейти в редактор
        </a>
      </div>
    </div>
  )
}
