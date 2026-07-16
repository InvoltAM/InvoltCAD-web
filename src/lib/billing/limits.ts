export interface PlanLimits {
  maxProjects: number | null
  maxExportsPerMonth: number | null
  creditsIncludedMonthly: number
  features: {
    pdfExport: boolean
    dxfImport: boolean
    projectSharing: boolean
    marketplace: boolean
    aiAssistant: boolean
    prioritySupport: boolean
  }
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxProjects: 3,
    maxExportsPerMonth: 10,
    creditsIncludedMonthly: 0,
    features: {
      pdfExport: false,
      dxfImport: false,
      projectSharing: false,
      marketplace: false,
      aiAssistant: false,
      prioritySupport: false,
    },
  },
  pro: {
    maxProjects: 50,
    maxExportsPerMonth: 200,
    creditsIncludedMonthly: 100,
    features: {
      pdfExport: true,
      dxfImport: true,
      projectSharing: true,
      marketplace: true,
      aiAssistant: false,
      prioritySupport: false,
    },
  },
  business: {
    maxProjects: null,
    maxExportsPerMonth: null,
    creditsIncludedMonthly: 500,
    features: {
      pdfExport: true,
      dxfImport: true,
      projectSharing: true,
      marketplace: true,
      aiAssistant: true,
      prioritySupport: true,
    },
  },
}

export function getPlanLimits(slug: string): PlanLimits {
  return PLAN_LIMITS[slug] ?? PLAN_LIMITS.free
}

export function isFeatureEnabled(slug: string, feature: keyof PlanLimits['features']): boolean {
  const limits = getPlanLimits(slug)
  return limits.features[feature]
}

export async function getUserPlanSlug(userId: string): Promise<string> {
  const { prisma } = await import('@/lib/prisma')
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: 'active',
      currentPeriodEnd: { gt: new Date() },
    },
    include: { plan: true },
    orderBy: { currentPeriodEnd: 'desc' },
  })
  return subscription?.plan.slug ?? 'free'
}

export async function getUserLimits(userId: string): Promise<PlanLimits> {
  const slug = await getUserPlanSlug(userId)
  return getPlanLimits(slug)
}
