import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { SerializedPlan } from '@/lib/projects/serializer'

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
    const { role } = await assertProjectAccess(id, user.id, 'viewer')

    const fullProject = await prisma.project.findUnique({
      where: { id },
      include: {
        walls: true,
        openings: true,
        devices: true,
        cables: true,
        dimensions: true,
        rooms: true,
        consumers: true,
        circuits: { include: { consumers: true } },
        distributionBoards: true,
        cableRuns: true,
        estimates: { include: { items: true } },
        invoices: true,
        documents: true,
        automationConfigs: true,
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
      devices: fullProject.devices.map((d) => {
        const props = (d.properties as Record<string, unknown>) || {}
        return {
          id: d.id,
          deviceType: d.deviceType,
          name: d.name,
          wallId: d.wallId ?? '',
          t: d.wallT ?? 0,
          side: d.wallSide ?? 1,
          offset: d.offset,
          height: d.height ?? undefined,
          rotation: d.rotation,
          iconScale: typeof props.iconScale === 'number' ? props.iconScale : undefined,
          nameOffset:
            props.nameOffset && typeof props.nameOffset === 'object'
              ? { x: Number((props.nameOffset as { x?: unknown }).x ?? 0), y: Number((props.nameOffset as { y?: unknown }).y ?? 0) }
              : undefined,
          position:
            props.position && typeof props.position === 'object'
              ? { x: Number((props.position as { x?: unknown }).x ?? 0), y: Number((props.position as { y?: unknown }).y ?? 0) }
              : undefined,
        }
      }),
      cables: fullProject.cables.map((c) => {
        const props = (c.properties as Record<string, unknown>) || {}
        const fromPoint = props.fromPoint && typeof props.fromPoint === 'object'
          ? { x: Number((props.fromPoint as { x?: unknown }).x ?? 0), y: Number((props.fromPoint as { y?: unknown }).y ?? 0) }
          : undefined
        const toPoint = props.toPoint && typeof props.toPoint === 'object'
          ? { x: Number((props.toPoint as { x?: unknown }).x ?? 0), y: Number((props.toPoint as { y?: unknown }).y ?? 0) }
          : undefined
        const viaPoints = Array.isArray(props.viaPoints)
          ? props.viaPoints.map((p) => {
              const pt = p && typeof p === 'object' ? (p as Record<string, unknown>) : null
              return { x: Number(pt?.x ?? 0), y: Number(pt?.y ?? 0) }
            })
          : undefined
        return {
          id: c.id,
          cableType: c.cableType,
          crossSection: c.crossSection,
          length: c.length ?? 0,
          totalLength: c.totalLength ?? undefined,
          route: (c.waypoints as Array<{ x: number; y: number }>) ?? [],
          fromDeviceId: c.sourceDeviceId || null,
          toDeviceId: c.targetDeviceId || null,
          fromPoint,
          toPoint,
          viaPoints,
          circuitId: typeof props.circuitId === 'string' ? props.circuitId : undefined,
          brand: typeof props.brand === 'string' ? props.brand : undefined,
          marking: typeof props.marking === 'string' ? props.marking : undefined,
          laid: typeof props.laid === 'boolean' ? props.laid : undefined,
          visible: typeof props.visible === 'boolean' ? props.visible : undefined,
        }
      }),
      dimensions: fullProject.dimensions.map((d) => ({
        id: d.id,
        startX: d.startX,
        startY: d.startY,
        endX: d.endX,
        endY: d.endY,
        length: d.length,
        text: d.text ?? undefined,
      })),
      primitives: [],
      electrical: {
        consumers: fullProject.consumers,
        circuits: fullProject.circuits.map((c) => ({ ...c, consumers: undefined })),
        distributionBoards: fullProject.distributionBoards,
        cableRuns: fullProject.cableRuns,
        priceItems: [],
        priceWorkItems: [],
        estimates: fullProject.estimates,
        invoices: fullProject.invoices,
        documents: fullProject.documents,
        automationConfigs: fullProject.automationConfigs,
        rooms: fullProject.rooms,
      },
    }

    return NextResponse.json({
      id: fullProject.id,
      name: fullProject.name,
      description: fullProject.description,
      crmClientId: fullProject.crmClientId,
      crmDealId: fullProject.crmDealId,
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
      prisma.estimateItem.deleteMany({ where: { estimate: { projectId: id } } }),
      prisma.automationConfig.deleteMany({ where: { projectId: id } }),
      prisma.document.deleteMany({ where: { projectId: id } }),
      prisma.invoice.deleteMany({ where: { projectId: id } }),
      prisma.estimate.deleteMany({ where: { projectId: id } }),
      prisma.cableRun.deleteMany({ where: { projectId: id } }),
      prisma.consumer.deleteMany({ where: { projectId: id } }),
      prisma.circuit.deleteMany({ where: { projectId: id } }),
      prisma.distributionBoard.deleteMany({ where: { projectId: id } }),
      prisma.room.deleteMany({ where: { projectId: id } }),
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
          properties: {
            iconScale: d.iconScale,
            nameOffset: d.nameOffset,
            position: d.position,
          },
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
          properties: {
            fromPoint: c.fromPoint,
            toPoint: c.toPoint,
            viaPoints: c.viaPoints,
            circuitId: c.circuitId,
            brand: c.brand,
            marking: c.marking,
            laid: c.laid,
            visible: c.visible,
          },
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

    // Electrical & calculation data
    const elec = planData.electrical ?? {}

    for (const r of elec.rooms ?? []) {
      await prisma.room.create({
        data: {
          id: r.id,
          projectId: id,
          name: r.name,
          area: r.area,
          perimeter: r.perimeter,
          centroidX: r.centroidX,
          centroidY: r.centroidY,
          type: r.type ?? 'other',
          heightMm: r.heightMm,
        },
      })
    }

    for (const b of elec.distributionBoards ?? []) {
      await prisma.distributionBoard.create({
        data: {
          id: b.id,
          projectId: id,
          name: b.name,
          inBreakerA: b.inBreakerA,
          inBreakerType: b.inBreakerType,
          rcdIn: b.rcdIn ?? false,
          rcdInMA: b.rcdInMA,
          rcdInType: b.rcdInType,
          voltage: b.voltage ?? 230,
          phases: b.phases ?? 'single',
          dinModules: b.dinModules ?? 0,
          enclosureType: b.enclosureType ?? 'surface',
          manufacturer: b.manufacturer,
          article: b.article,
          priceLevel: b.priceLevel ?? 'standard',
          properties: b.properties ?? {},
        },
      })
    }

    for (const c of elec.circuits ?? []) {
      await prisma.circuit.create({
        data: {
          id: c.id,
          projectId: id,
          boardId: c.boardId || null,
          name: c.name,
          type: c.type,
          ratedCurrentA: c.ratedCurrentA,
          breakerType: c.breakerType,
          cableType: c.cableType,
          crossSectionMm2: c.crossSectionMm2,
          lengthM: c.lengthM,
          phase: c.phase ?? 'L1',
          color: c.color,
          sortOrder: c.sortOrder ?? 0,
        },
      })
    }

    for (const c of elec.consumers ?? []) {
      await prisma.consumer.create({
        data: {
          id: c.id,
          projectId: id,
          roomId: c.roomId || null,
          deviceId: c.deviceId || null,
          name: c.name,
          category: c.category,
          type: c.type,
          powerW: c.powerW ?? 0,
          voltage: c.voltage ?? 230,
          count: c.count ?? 1,
          demandRatio: c.demandRatio ?? 1,
          roomName: c.roomName,
          circuitId: c.circuitId || null,
          phase: c.phase ?? 'L1',
          properties: c.properties ?? {},
          sortOrder: c.sortOrder ?? 0,
        },
      })
    }

    for (const cr of elec.cableRuns ?? []) {
      await prisma.cableRun.create({
        data: {
          id: cr.id,
          projectId: id,
          circuitId: cr.circuitId || null,
          fromDeviceId: cr.fromDeviceId || null,
          toDeviceId: cr.toDeviceId || null,
          cableType: cr.cableType ?? 'power',
          crossSectionMm2: cr.crossSectionMm2 ?? 2.5,
          routeM: cr.routeM ?? 0,
          spareM: cr.spareM ?? 0,
          totalM: cr.totalM ?? 0,
          segments: cr.segments ?? [],
          description: cr.description,
        },
      })
    }

    for (const e of elec.estimates ?? []) {
      const created = await prisma.estimate.create({
        data: {
          id: e.id,
          projectId: id,
          crmDealId: e.crmDealId || null,
          name: e.name,
          priceLevel: e.priceLevel ?? 'standard',
          discountPercent: e.discountPercent ?? 0,
          vatPercent: e.vatPercent ?? 0,
          totalMaterial: e.totalMaterial ?? 0,
          totalWork: e.totalWork ?? 0,
          total: e.total ?? 0,
          status: e.status ?? 'draft',
          publicSlug: e.publicSlug,
          publicExpiresAt: e.publicExpiresAt ? new Date(e.publicExpiresAt) : null,
          properties: e.properties ?? {},
        },
      })
      for (const item of e.items ?? []) {
        await prisma.estimateItem.create({
          data: {
            id: item.id,
            estimateId: created.id,
            itemType: item.itemType,
            priceItemId: item.priceItemId || null,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity ?? 0,
            price: item.price ?? 0,
            total: item.total ?? 0,
            sortOrder: item.sortOrder ?? 0,
          },
        })
      }
    }

    for (const i of elec.invoices ?? []) {
      await prisma.invoice.create({
        data: {
          id: i.id,
          projectId: id,
          crmDealId: i.crmDealId || null,
          estimateId: i.estimateId || null,
          number: i.number,
          amount: i.amount ?? 0,
          currency: i.currency ?? 'RUB',
          vatPercent: i.vatPercent ?? 0,
          vatAmount: i.vatAmount ?? 0,
          status: i.status ?? 'draft',
          dueDate: i.dueDate ? new Date(i.dueDate) : null,
          paidAt: i.paidAt ? new Date(i.paidAt) : null,
          properties: i.properties ?? {},
        },
      })
    }

    for (const d of elec.documents ?? []) {
      await prisma.document.create({
        data: {
          id: d.id,
          projectId: id,
          crmDealId: d.crmDealId || null,
          type: d.type,
          name: d.name,
          fileUrl: d.fileUrl,
          status: d.status ?? 'draft',
          properties: d.properties ?? {},
        },
      })
    }

    for (const a of elec.automationConfigs ?? []) {
      await prisma.automationConfig.create({
        data: {
          id: a.id,
          projectId: id,
          platform: a.platform ?? 'wirenboard',
          name: a.name,
          script: a.script,
          devices: a.devices ?? [],
          properties: a.properties ?? {},
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



// PATCH /api/projects/[id] — обновление метаданных проекта (CRM-связи и т.п.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params

  try {
    await assertProjectAccess(id, user.id, 'editor')

    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name?.trim() || undefined
    if (body.description !== undefined) data.description = body.description?.trim() ?? null
    if (body.crmClientId !== undefined) data.crmClientId = body.crmClientId || null
    if (body.crmDealId !== undefined) data.crmDealId = body.crmDealId || null

    // Проверяем, что клиент/сделка принадлежат пользователю
    if (data.crmClientId) {
      const client = await prisma.crmClient.findUnique({ where: { id: data.crmClientId as string } })
      if (!client || client.userId !== user.id) {
        return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
      }
    }
    if (data.crmDealId) {
      const deal = await prisma.crmDeal.findUnique({ where: { id: data.crmDealId as string } })
      if (!deal || deal.userId !== user.id) {
        return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка обновления'
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
