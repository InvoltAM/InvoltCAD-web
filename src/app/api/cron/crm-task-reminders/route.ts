import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, isEmailConfigured } from '@/lib/email'

function getCronSecret() {
  return process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || ''
}

// GET/POST /api/cron/crm-task-reminders — автоматическая отправка напоминаний по задачам CRM
export async function GET(request: NextRequest) {
  return handleCron(request)
}

export async function POST(request: NextRequest) {
  return handleCron(request)
}

async function handleCron(request: NextRequest) {
  const secret = getCronSecret()
  if (secret) {
    const auth = request.headers.get('authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    if (token !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'SMTP не настроен' })
  }

  const users = (await prisma.user.findMany({
    select: { id: true, email: true },
  })).filter((u): u is { id: string; email: string } => Boolean(u.email))

  const result: { userId: string; sent: number; errors: string[] }[] = []

  for (const user of users) {
    const tasks = await prisma.crmTask.findMany({
      where: {
        userId: user.id,
        reminderSent: false,
        reminderAt: { lte: new Date() },
      },
    })

    let sent = 0
    const errors: string[] = []

    for (const task of tasks) {
      try {
        await sendEmail({
          to: user.email!,
          subject: `Напоминание: ${task.title}`,
          html: `<p>Напоминание о задаче:</p><p><b>${task.title}</b></p>${task.description ? `<p>${task.description}</p>` : ''}<p>Срок: ${task.dueDate ? new Date(task.dueDate).toLocaleString('ru-RU') : 'не указан'}</p>`,
        })

        await prisma.crmTask.update({
          where: { id: task.id },
          data: { reminderSent: true },
        })

        await prisma.crmActivityLog.create({
          data: {
            userId: user.id,
            action: 'task_reminder_sent',
            entityType: 'task',
            entityId: task.id,
            details: { title: task.title },
          },
        })

        sent++
      } catch (err) {
        errors.push(`${task.title}: ${err instanceof Error ? err.message : 'unknown'}`)
      }
    }

    if (sent > 0 || errors.length > 0 || tasks.length > 0) {
      result.push({ userId: user.id, sent, errors })
    }
  }

  const totalSent = result.reduce((sum, r) => sum + r.sent, 0)
  return NextResponse.json({ ok: true, totalSent, users: result.length, details: result })
}
