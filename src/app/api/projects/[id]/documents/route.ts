import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { DocumentData } from '@core/estimates/EstimateEngine'

interface RouteParams {
  params: Promise<{ id: string }>
}

function documentToDto(doc: any): DocumentData {
  return {
    id: doc.id,
    projectId: doc.projectId,
    type: doc.type,
    name: doc.name,
    status: doc.status,
    content: doc.properties?.content,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  }
}

// GET /api/projects/[id]/documents — список документов проекта
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  try {
    await assertProjectAccess(id, user.id, 'viewer')
    const documents = await prisma.document.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(documents.map(documentToDto))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// POST /api/projects/[id]/documents — создать документ
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  try {
    await assertProjectAccess(id, user.id, 'editor')
    const body: DocumentData = await request.json()

    const doc = await prisma.document.create({
      data: {
        projectId: id,
        type: body.type ?? 'estimate',
        name: body.name || 'Документ',
        status: body.status ?? 'draft',
        properties: { content: body.content ?? '' },
      },
    })

    return NextResponse.json(documentToDto(doc), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
