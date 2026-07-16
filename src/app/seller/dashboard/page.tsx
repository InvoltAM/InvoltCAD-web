'use client'

import { useEffect, useState } from 'react'

interface SellerStats {
  totalItems: number
  totalSales: number
  totalEarnings: number
  totalReviews: number
  avgRating: number | null
  recentSales: Array<{
    itemName: string
    itemType: string
    price: number
    earnings: number
    date: string
  }>
  items: Array<{
    id: string
    name: string
    type: string
    salesCount: number
    rating: number | null
    published: boolean
  }>
}

export default function SellerDashboardPage() {
  const [stats, setStats] = useState<SellerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/marketplace/seller/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Ошибка загрузки</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-900 dark:text-white">
          Кабинет продавца
        </h1>

        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">Товаров</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalItems}</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">Продаж</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSales}</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">Выручка</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEarnings} ₽</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">Рейтинг</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.avgRating ? `★ ${stats.avgRating.toFixed(1)}` : '—'}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
              Мои товары
            </h2>
            {stats.items.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">Нет товаров</p>
            ) : (
              <div className="space-y-2">
                {stats.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {item.type} • Продаж: {item.salesCount}
                      </div>
                    </div>
                    <div className="text-right">
                      {item.rating !== null && (
                        <div className="text-yellow-500">★ {item.rating.toFixed(1)}</div>
                      )}
                      <div className={`text-xs ${item.published ? 'text-green-600' : 'text-gray-400'}`}>
                        {item.published ? 'Опубликован' : 'Скрыт'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
              Последние продажи
            </h2>
            {stats.recentSales.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">Нет продаж</p>
            ) : (
              <div className="space-y-2">
                {stats.recentSales.map((sale, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{sale.itemName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(sale.date).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900 dark:text-white">+{sale.earnings} ₽</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{sale.price} ₽</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
