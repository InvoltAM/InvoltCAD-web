import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { serializePlan, deserializePlan, SerializedPlan } from '@/lib/projects/serializer'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id] — загрузка проекта
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params

  try {
    const { project, role } = await assertProjectAccess(id, user.id, 'viewer')

    const fullProject = await prisma.project.findUnique({
      where: { id },
      include: {
        walls: true,
        openings: true,
        devices: true,
        cables: true,
        dimensions: true,
      },
    })

    if (!fullProject) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    }

    const serialized: SerializedPlan = {
      walls: fullProject.walls.map((w) => ({
        id: w.id,
        startX: w.startX,
        startY: w.startY,
        endX: w.endX,
        endY: w.endY,
        thickness: w.thickness,
        arcRadius: w.arcRadius ?? undefined,
        arcClockwise: w.arcClockwise ?? undefined,
      })),
      openings: fullProject.openings.map((o) => ({
        id: o.id,
        wallId: o.wallId,
        t: o.offset,
        width: o.width,
        type: o.type as 'door' | 'window',
        height: o.height,
        swingSide: o.swingSide as 'left' | 'right',
        openDir: o.openDir as 1 | -1,
      })),
      devices: fullProject.devices.map((d) => ({
        id: d.id,
        deviceType: d.deviceType,
        name: d.name,
        wallId: d.wallId ?? '',
        t: d.wallT ?? 0,
        side: d.wallSide ?? 1,
        offset: d.offset,
        height: d.height ?? undefined,
        rotation: d.rotation,
      })),
      cables: fullProject.cables.map((c) => ({
        id: c.id,
        cableType: c.cableType,
        crossSection: c.crossSection,
        length: c.length ?? 0,
        totalLength: c.totalLength ?? undefined,
        route: (c.waypoints as Array<{ x: number; y: number }>) ?? [],
        fromDeviceId: c.sourceDeviceId ?? '',
        toDeviceId: c.targetDeviceId ?? '',
      })),
      dimensions: fullProject.dimensions.map((d) => ({
        id: d.id,
        startX: d.startX,
        startY: d.startY,
        endX: d.endX,
        endY: d.endY,
        length: d.length,
        text: d.text ?? undefined,
      })),
    }

    return NextResponse.json({
      id: fullProject.id,
      name: fullProject.name,
      description: fullProject.description,
      updatedAt: fullProject.updatedAt,
      role,
      plan: serialized,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка загрузки'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// PUT /api/projects/[id] — сохранение проекта
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params

  try {
    await assertProjectAccess(id, user.id, 'editor')

    const body = await request.json()
    const planData: SerializedPlan = body.plan

    // Удаляем старые данные и создаём новые (простой подход)
    await prisma.$transaction([
      prisma.opening.deleteMany({ where: { projectId: id } }),
      prisma.device.deleteMany({ where: { projectId: id } }),
      prisma.cable.deleteMany({ where: { projectId: id } }),
      prisma.dimension.deleteMany({ where: { projectId: id } }),
      prisma.wall.deleteMany({ where: { projectId: id } }),
    ])

    // Создаём стены
    for (const w of planData.walls) {
      await prisma.wall.create({
        data: {
          id: w.id,
          projectId: id,
          startX: w.startX,
          startY: w.startY,
          endX: w.endX,
          endY: w.endY,
          thickness: w.thickness,
          arcRadius: w.arcRadius,
          arcClockwise: w.arcClockwise,
        },
      })
    }

    // Создаём проёмы
    for (const o of planData.openings) {
      await prisma.opening.create({
        data: {
          id: o.id,
          projectId: id,
          wallId: o.wallId,
          offset: o.t,
          width: o.width,
          type: o.type,
          height: o.height,
          swingSide: o.swingSide,
          openDir: o.openDir,
        },
      })
    }

    // Создаём устройства
    for (const d of planData.devices) {
      await prisma.device.create({
        data: {
          id: d.id,
          projectId: id,
          deviceType: d.deviceType,
          name: d.name,
          wallId: d.wallId || null,
          wallT: d.t,
          wallSide: d.side,
          offset: d.offset,
          height: d.height,
          rotation: d.rotation,
          properties: {},
        },
      })
    }

    // Создаём кабели
    for (const c of planData.cables) {
      await prisma.cable.create({
        data: {
          id: c.id,
          projectId: id,
          cableType: c.cableType,
          crossSection: c.crossSection,
          length: c.length,
          totalLength: c.totalLength,
          waypoints: c.route,
          sourceDeviceId: c.fromDeviceId || null,
          targetDeviceId: c.toDeviceId || null,
        },
      })
    }

    // Создаём размеры
    for (const d of planData.dimensions) {
      await prisma.dimension.create({
        data: {
          id: d.id,
          projectId: id,
          startX: d.startX,
          startY: d.startY,
          endX: d.endX,
          endY: d.endY,
          length: d.length,
          text: d.text,
        },
      })
    }

    // Обновляем метаданные проекта
    const updated = await prisma.project.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка сохранения'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/projects/[id] — удаление проекта
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params

  try {
    await assertProjectAccess(id, user.id, 'owner')

    await prisma.project.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка удаления'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
