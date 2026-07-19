'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface MarketplaceItem {
  id: string
  type: 'device' | 'template'
  name: string
  description: string
  category: string
  price: number | null
  currency: string
  salesCount: number
  rating: number | null
  seller: { id: string; name: string | null; image: string | null } | null
  svg?: string
  thumbnail?: string
}

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'device' | 'template'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('type', filter)
    if (search) params.set('search', search)

    fetch(`/api/marketplace/items?${params}`)
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [filter, search])

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Маркетплейс
          </h1>
          <Link
            href="/seller/dashboard"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Кабинет продавца
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <div className="flex gap-2">
            {(['all', 'device', 'template'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {f === 'all' ? 'Все' : f === 'device' ? 'Устройства' : 'Шаблоны'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-500">Товары не найдены</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={`/marketplace/${item.id}`}
                className="rounded-lg bg-white p-4 shadow-md transition-shadow hover:shadow-lg dark:bg-gray-800"
              >
                <div className="mb-3 flex h-32 items-center justify-center rounded bg-gray-100 dark:bg-gray-700">
                  {item.svg ? (
                    <div
                      className="h-24 w-24"
                      dangerouslySetInnerHTML={{ __html: item.svg }}
                    />
                  ) : item.thumbnail ? (
                    <Image
                      src={item.thumbnail}
                      alt={item.name}
                      width={128}
                      height={128}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">📦</span>
                  )}
                </div>
                <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">
                  {item.name}
                </h3>
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  {item.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {item.price === null || item.price === 0
                      ? 'Бесплатно'
                      : `${item.price} ${item.currency}`}
                  </span>
                  {item.rating !== null && (
                    <span className="text-sm text-yellow-500">
                      ★ {item.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Продаж: {item.salesCount} • {item.seller?.name ?? 'InvoltCAD'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
