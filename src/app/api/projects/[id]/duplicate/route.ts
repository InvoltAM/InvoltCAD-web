import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/projects/[id]/duplicate — дублирование проекта
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params

  try {
    await assertProjectAccess(id, user.id, 'viewer')

    const original = await prisma.project.findUnique({
      where: { id },
      include: {
        walls: true,
        openings: true,
        devices: true,
        cables: true,
        dimensions: true,
      },
    })

    if (!original) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    }

    // Создаём копию проекта
    const copy = await prisma.project.create({
      data: {
        name: `${original.name} (копия)`,
        description: original.description,
        userId: user.id,
      },
    })

    // Копируем стены
    const wallIdMap = new Map<string, string>()
    for (const w of original.walls) {
      const newWall = await prisma.wall.create({
        data: {
          projectId: copy.id,
          startX: w.startX,
          startY: w.startY,
          endX: w.endX,
          endY: w.endY,
          thickness: w.thickness,
          arcRadius: w.arcRadius,
          arcClockwise: w.arcClockwise,
        },
      })
      wallIdMap.set(w.id, newWall.id)
    }

    // Копируем проёмы
    for (const o of original.openings) {
      const newWallId = wallIdMap.get(o.wallId)
      if (!newWallId) continue
      await prisma.opening.create({
        data: {
          projectId: copy.id,
          wallId: newWallId,
          offset: o.offset,
          width: o.width,
          type: o.type,
          height: o.height,
          swingSide: o.swingSide,
          openDir: o.openDir,
        },
      })
    }

    // Копируем устройства
    const deviceIdMap = new Map<string, string>()
    for (const d of original.devices) {
      const newDevice = await prisma.device.create({
        data: {
          projectId: copy.id,
          deviceType: d.deviceType,
          name: d.name,
          wallId: d.wallId ? wallIdMap.get(d.wallId) ?? null : null,
          wallT: d.wallT,
          wallSide: d.wallSide,
          offset: d.offset,
          height: d.height,
          rotation: d.rotation,
          properties: d.properties ?? {},
        },
      })
      deviceIdMap.set(d.id, newDevice.id)
    }

    // Копируем кабели
    for (const c of original.cables) {
      await prisma.cable.create({
        data: {
          projectId: copy.id,
          cableType: c.cableType,
          crossSection: c.crossSection,
          length: c.length,
          totalLength: c.totalLength,
          waypoints: c.waypoints as Array<{ x: number; y: number }>,
          sourceDeviceId: c.sourceDeviceId ? deviceIdMap.get(c.sourceDeviceId) ?? null : null,
          targetDeviceId: c.targetDeviceId ? deviceIdMap.get(c.targetDeviceId) ?? null : null,
        },
      })
    }

    // Копируем размеры
    for (const d of original.dimensions) {
      await prisma.dimension.create({
        data: {
          projectId: copy.id,
          startX: d.startX,
          startY: d.startY,
          endX: d.endX,
          endY: d.endY,
          length: d.length,
          text: d.text,
        },
      })
    }

    return NextResponse.json(copy, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка дублирования'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
