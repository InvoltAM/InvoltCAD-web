import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { ProjectRole } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string; userId: string }>
}

// PUT /api/projects/[id]/members/[userId] — изменение роли участника
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id, userId } = await params

  try {
    await assertProjectAccess(id, user.id, 'owner')

    const body = await request.json()
    const { role } = body

    if (!['editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 })
    }

    // Нельзя изменить роль владельца
    const project = await prisma.project.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (project?.userId === userId) {
      return NextResponse.json({ error: 'Нельзя изменить роль владельца' }, { status: 400 })
    }

    const member = await prisma.projectMember.update({
      where: {
        projectId_userId: {
          projectId: id,
          userId,
        },
      },
      data: { role: role as ProjectRole },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    return NextResponse.json(member)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка изменения роли'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/projects/[id]/members/[userId] — удаление участника
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id, userId } = await params

  try {
    await assertProjectAccess(id, user.id, 'owner')

    // Нельзя удалить владельца
    const project = await prisma.project.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (project?.userId === userId) {
      return NextResponse.json({ error: 'Нельзя удалить владельца' }, { status: 400 })
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: id,
          userId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка удаления участника'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
