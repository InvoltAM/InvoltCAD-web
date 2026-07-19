import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Project, ProjectRole } from '@prisma/client'

export async function getSessionUser() {
  const session = await auth()
  return session?.user ?? null
}

export async function assertProjectAccess(
  projectId: string,
  userId: string,
  minRole: ProjectRole = 'viewer'
): Promise<{ project: Project; role: ProjectRole }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        where: { userId },
      },
    },
  })

  if (!project) {
    throw new Error('Проект не найден')
  }

  // Владелец проекта имеет полный доступ
  if (project.userId === userId) {
    return { project, role: 'owner' }
  }

  // Проверяем членство
  const member = project.members[0]
  if (!member) {
    throw new Error('Нет доступа к проекту')
  }

  const roleHierarchy: Record<ProjectRole, number> = {
    owner: 3,
    editor: 2,
    viewer: 1,
  }

  if (roleHierarchy[member.role] < roleHierarchy[minRole]) {
    throw new Error('Недостаточно прав')
  }

  return { project, role: member.role }
}

export async function getProjectRole(
  projectId: string,
  userId: string
): Promise<ProjectRole | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })

  if (!project) return null
  if (project.userId === userId) return 'owner'

  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  })

  return member?.role ?? null
}
