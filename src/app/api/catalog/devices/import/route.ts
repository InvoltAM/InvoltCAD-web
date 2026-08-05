import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

interface ImportResult {
  created: number
  errors: string[]
  items: Array<{ id: string; name: string; nameRu: string; deviceType: string }>
}

// POST /api/catalog/devices/import — импорт устройств из CSV
// Формат: category;deviceType;name;nameRu;width;height;price;svg;properties(JSON)
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await request.json()
  const csv: string = body.csv || ''
  const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean)

  const result: ImportResult = { created: 0, errors: [], items: [] }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const parts = line.split(';')
    if (parts.length < 7) {
      result.errors.push(`Строка ${i + 1}: нужно минимум 7 полей (category;deviceType;name;nameRu;width;height;price[;svg;properties])`)
      continue
    }

    const [category, deviceType, name, nameRu, widthStr, heightStr, priceStr, svg = '', propertiesStr = ''] = parts

    if (!category || !deviceType || !name || !nameRu) {
      result.errors.push(`Строка ${i + 1}: пустые обязательные поля`)
      continue
    }

    const width = Number(widthStr) || 50
    const height = Number(heightStr) || 50
    const price = Number(priceStr) || 0

    let properties: any[] = []
    if (propertiesStr.trim()) {
      try {
        properties = JSON.parse(propertiesStr.trim())
        if (!Array.isArray(properties)) properties = []
      } catch {
        result.errors.push(`Строка ${i + 1}: невалидный JSON в properties`)
      }
    }

    try {
      const item = await prisma.deviceCatalogItem.create({
        data: {
          userId: user.id,
          category: category.trim(),
          deviceType: deviceType.trim(),
          name: name.trim(),
          nameRu: nameRu.trim(),
          svg: svg.trim() || defaultSvg(deviceType.trim()),
          width,
          height,
          price: Math.round(price * 100), // в копейках
          currency: 'RUB',
          properties,
          published: false,
          isBuiltin: false,
        },
      })
      result.created++
      result.items.push({ id: item.id, name: item.name, nameRu: item.nameRu, deviceType: item.deviceType })
    } catch (e: any) {
      result.errors.push(`Строка ${i + 1}: ${e.message || 'ошибка сохранения'}`)
    }
  }

  return NextResponse.json(result)
}

function defaultSvg(deviceType: string): string {
  const color = deviceType.includes('light') ? '#f59e0b' : '#3b82f6'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect x="8" y="8" width="24" height="24" rx="4" fill="${color}"/></svg>`
}
