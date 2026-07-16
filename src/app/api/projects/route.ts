import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { serializePlan, deserializePlan } from '@/lib/projects/serializer'
import { Plan } from '@core/model/Plan'

// GET /api/projects — список проектов пользователя
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { userId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    include: {
      members: {
        where: { userId: user.id },
        select: { role: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      updatedAt: p.updatedAt,
      role: p.userId === user.id ? 'owner' : p.members[0]?.role ?? 'viewer',
    }))
  )
}

// POST /api/projects — создание проекта
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const name = body.name?.trim() || 'Новый проект'

  const project = await prisma.project.create({
    data: {
      name,
      description: body.description ?? '',
      userId: user.id,
    },
  })

  return NextResponse.json(project, { status: 201 })
}
