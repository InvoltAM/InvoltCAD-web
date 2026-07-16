export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md dark:bg-gray-800">
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          Проверьте почту
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Мы отправили вам ссылку для входа. Перейдите по ней, чтобы завершить вход.
        </p>
      </div>
    </div>
  )
}
