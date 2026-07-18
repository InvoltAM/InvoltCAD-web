import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // Создаём тарифы
  const plans = [
    {
      slug: 'free',
      name: 'Бесплатный',
      description: 'Для личного использования',
      priceMonthly: 0,
      priceYearly: 0,
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
    {
      slug: 'pro',
      name: 'Pro',
      description: 'Для профессионалов',
      priceMonthly: 990,
      priceYearly: 9900,
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
    {
      slug: 'business',
      name: 'Business',
      description: 'Для команд и компаний',
      priceMonthly: 2990,
      priceYearly: 29900,
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
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    })
  }

  console.log('Seed completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
