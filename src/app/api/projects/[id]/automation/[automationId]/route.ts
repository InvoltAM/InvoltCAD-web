import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { AutomationConfigData, AutomationDeviceMapping } from '@core/automation/AutomationEngine'

interface RouteParams {
  params: Promise<{ id: string; automationId: string }>
}

function dto(config: any): AutomationConfigData {
  return {
    id: config.id,
    projectId: config.projectId,
    platform: config.platform,
    name: config.name,
    script: config.script,
    devices: (config.devices as AutomationDeviceMapping[]) ?? [],
    createdAt: config.createdAt?.toISOString(),
    updatedAt: config.updatedAt?.toISOString(),
  }
}

async function checkAccess(projectId: string, automationId: string, userId: string) {
  await assertProjectAccess(projectId, userId, 'editor')
  const config = await prisma.automationConfig.findUnique({ where: { id: automationId } })
  if (!config || config.projectId !== projectId) {
    throw new Error('Конфиг не найден')
  }
  return config
}

// PUT /api/projects/[id]/automation/[automationId] — обновить конфиг
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, automationId } = await params
  try {
    await checkAccess(id, automationId, user.id)
    const body: AutomationConfigData = await request.json()

    const config = await prisma.automationConfig.update({
      where: { id: automationId },
      data: {
        platform: body.platform,
        name: body.name,
        script: body.script,
        devices: (body.devices ?? []) as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json(dto(config))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/projects/[id]/automation/[automationId] — удалить конфиг
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, automationId } = await params
  try {
    await checkAccess(id, automationId, user.id)
    await prisma.automationConfig.delete({ where: { id: automationId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
