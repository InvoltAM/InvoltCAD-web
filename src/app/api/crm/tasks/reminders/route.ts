import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { sendEmail, isEmailConfigured } from '@/lib/email'

// GET /api/crm/tasks/reminders — задачи с приближающимся напоминанием
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const tasks = await prisma.crmTask.findMany({
    where: {
      userId: user.id,
      reminderSent: false,
      reminderAt: { lte: new Date() },
    },
    orderBy: { reminderAt: 'asc' },
  })

  return NextResponse.json(tasks)
}

// POST /api/crm/tasks/reminders/check — отправить напоминания по задачам
export async function POST() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'SMTP не настроен' }, { status: 503 })
  }

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

  return NextResponse.json({ sent, total: tasks.length, errors })
}
