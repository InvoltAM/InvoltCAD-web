import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { AutomationConfigData, AutomationDeviceMapping } from '@core/automation/AutomationEngine'

interface RouteParams {
  params: Promise<{ id: string }>
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

// GET /api/projects/[id]/automation — список конфигов автоматизации
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  try {
    await assertProjectAccess(id, user.id, 'viewer')
    const configs = await prisma.automationConfig.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(configs.map(dto))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// POST /api/projects/[id]/automation — создать конфиг автоматизации
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  try {
    await assertProjectAccess(id, user.id, 'editor')
    const body: AutomationConfigData = await request.json()

    const config = await prisma.automationConfig.create({
      data: {
        projectId: id,
        platform: body.platform ?? 'wirenboard',
        name: body.name || 'Конфиг автоматизации',
        script: body.script || '',
        devices: (body.devices ?? []) as unknown as Prisma.InputJsonValue,
        properties: {},
      },
    })

    return NextResponse.json(dto(config), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
