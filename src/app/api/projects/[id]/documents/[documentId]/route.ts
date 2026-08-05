import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { DocumentData } from '@core/estimates/EstimateEngine'

interface RouteParams {
  params: Promise<{ id: string; documentId: string }>
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

async function checkDocumentAccess(projectId: string, documentId: string, userId: string) {
  await assertProjectAccess(projectId, userId, 'editor')
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc || doc.projectId !== projectId) {
    throw new Error('Документ не найден')
  }
  return doc
}

// PUT /api/projects/[id]/documents/[documentId] — обновить документ
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, documentId } = await params
  try {
    await checkDocumentAccess(id, documentId, user.id)
    const body: DocumentData = await request.json()

    const doc = await prisma.document.update({
      where: { id: documentId },
      data: {
        type: body.type,
        name: body.name,
        status: body.status,
        properties: { content: body.content ?? '' },
      },
    })

    return NextResponse.json(documentToDto(doc))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/projects/[id]/documents/[documentId] — удалить документ
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, documentId } = await params
  try {
    await checkDocumentAccess(id, documentId, user.id)
    await prisma.document.delete({ where: { id: documentId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
