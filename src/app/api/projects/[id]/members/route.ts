import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { ProjectRole } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id]/members — список участников проекта
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params

  try {
    await assertProjectAccess(id, user.id, 'viewer')

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    const owner = await prisma.project.findUnique({
      where: { id },
      select: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    return NextResponse.json({
      owner: owner?.user ?? null,
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
        createdAt: m.createdAt,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка загрузки'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// POST /api/projects/[id]/members — приглашение участника
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params

  try {
    await assertProjectAccess(id, user.id, 'owner')

    const body = await request.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json({ error: 'Укажите email и роль' }, { status: 400 })
    }

    if (!['editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 })
    }

    // Ищем пользователя по email
    const invitedUser = await prisma.user.findUnique({
      where: { email },
    })

    if (!invitedUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Проверяем, не является ли он уже участником
    const existing = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: id,
          userId: invitedUser.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Пользователь уже является участником' }, { status: 400 })
    }

    // Создаём участника
    const member = await prisma.projectMember.create({
      data: {
        projectId: id,
        userId: invitedUser.id,
        role: role as ProjectRole,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка приглашения'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
