import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

interface RouteParams {
  params: Promise<{ id: string; estimateId: string }>
}

function generateSlug(): string {
  return crypto.randomBytes(12).toString('hex')
}

// POST /api/projects/[id]/estimates/[estimateId]/publish — опубликовать смету
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, estimateId } = await params
  try {
    await assertProjectAccess(id, user.id, 'editor')
    const estimate = await prisma.estimate.findUnique({ where: { id: estimateId } })
    if (!estimate || estimate.projectId !== id) {
      return NextResponse.json({ error: 'Смета не найдена' }, { status: 404 })
    }

    const publicSlug = estimate.publicSlug || generateSlug()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 дней

    const updated = await prisma.estimate.update({
      where: { id: estimateId },
      data: { publicSlug, publicExpiresAt: expiresAt },
    })

    const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/public/estimates/${publicSlug}`
    return NextResponse.json({ publicSlug, publicUrl, publicExpiresAt: updated.publicExpiresAt?.toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/projects/[id]/estimates/[estimateId]/publish — снять с публикации
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, estimateId } = await params
  try {
    await assertProjectAccess(id, user.id, 'editor')
    await prisma.estimate.update({
      where: { id: estimateId },
      data: { publicSlug: null, publicExpiresAt: null },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
