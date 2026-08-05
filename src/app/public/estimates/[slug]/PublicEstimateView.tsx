'use client'

import { useState } from 'react'
import { EstimateData } from '@core/estimates/EstimateEngine'

export default function PublicEstimateView({ estimate, projectName, slug }: { estimate: EstimateData; projectName: string; slug: string }) {
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePay = async () => {
    setPaying(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/estimates/${slug}/pay`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка оплаты')
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl
      } else {
        throw new Error('Не получена ссылка на оплату')
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка')
    } finally {
      setPaying(false)
    }
  }

  const priceLevelName = estimate.priceLevel === 'budget' ? 'Бюджет' : estimate.priceLevel === 'premium' ? 'Премиум' : 'Стандарт'

  return (
    <div className="mx-auto max-w-3xl rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <div className="mb-6 border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Коммерческое предложение</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Проект: {projectName}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">Смета: {estimate.name}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">Уровень цен: {priceLevelName}</p>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 dark:border-gray-700">
          <tr className="text-gray-600 dark:text-gray-400">
            <th className="py-2">№</th>
            <th className="py-2">Наименование</th>
            <th className="py-2">Ед.</th>
            <th className="py-2 text-right">Кол-во</th>
            <th className="py-2 text-right">Цена</th>
            <th className="py-2 text-right">Сумма</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {estimate.items.map((item, idx) => (
            <tr key={item.id}>
              <td className="py-2 text-gray-500 dark:text-gray-400">{idx + 1}</td>
              <td className="py-2 text-gray-900 dark:text-white">{item.name}</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">{item.unit}</td>
              <td className="py-2 text-right text-gray-900 dark:text-white">{item.quantity}</td>
              <td className="py-2 text-right text-gray-900 dark:text-white">{(item.price / 100).toFixed(2)} ₽</td>
              <td className="py-2 text-right font-medium text-gray-900 dark:text-white">{(item.total / 100).toFixed(2)} ₽</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 space-y-1 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex justify-between">
          <span>Материалы</span>
          <span>{(estimate.totalMaterial / 100).toFixed(2)} ₽</span>
        </div>
        <div className="flex justify-between">
          <span>Работы</span>
          <span>{(estimate.totalWork / 100).toFixed(2)} ₽</span>
        </div>
        {estimate.discountPercent > 0 && (
          <div className="flex justify-between text-red-600 dark:text-red-400">
            <span>Скидка {estimate.discountPercent}%</span>
            <span>-{((estimate.totalMaterial + estimate.totalWork) * (estimate.discountPercent / 100) / 100).toFixed(2)} ₽</span>
          </div>
        )}
        {estimate.vatPercent > 0 && (
          <div className="flex justify-between">
            <span>НДС {estimate.vatPercent}%</span>
            <span>{(estimate.total * (estimate.vatPercent / 100) / (1 + estimate.vatPercent / 100) / 100).toFixed(2)} ₽</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-white">
          <span>Итого к оплате</span>
          <span>{(estimate.total / 100).toFixed(2)} ₽</span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Статус: {statusName(estimate.status)}
        </div>
        <button
          onClick={handlePay}
          disabled={paying || estimate.total <= 0}
          className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {paying ? 'Создание платежа...' : 'Оплатить'}
        </button>
      </div>
    </div>
  )
}

function statusName(status: string): string {
  const names: Record<string, string> = { draft: 'Черновик', sent: 'Отправлено', accepted: 'Принято', rejected: 'Отклонено' }
  return names[status] || status
}
