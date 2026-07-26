import { PrismaAdapter } from '@auth/prisma-adapter'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Email from 'next-auth/providers/email'
import { prisma } from './prisma'

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

function createAuth() {
  const providers: unknown[] = [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ]

  // Email-провайдер добавляем только если настроен SMTP
  if (process.env.EMAIL_SERVER_HOST) {
    providers.push(
      Email({
        server: {
          host: process.env.EMAIL_SERVER_HOST,
          port: Number(process.env.EMAIL_SERVER_PORT),
          auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          },
        },
        from: process.env.EMAIL_FROM,
      })
    )
  }

  // Во время сборки используем JWT и не подключаемся к БД
  if (isBuildTime) {
    return NextAuth({
      // @ts-expect-error — типы провайдеров NextAuth сложны
      providers,
      session: { strategy: 'jwt' },
      pages: {
        signIn: '/login',
        verifyRequest: '/verify',
      },
    })
  }

  return NextAuth({
    adapter: PrismaAdapter(prisma),
    // @ts-expect-error — типы провайдеров NextAuth сложны
    providers,
    session: {
      strategy: 'database',
    },
    callbacks: {
      async session({ session, user }) {
        if (session.user) {
          session.user.id = user.id
          // Загружаем роль и кредиты из БД
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, credits: true },
          })
          if (dbUser) {
            session.user.role = dbUser.role
            session.user.credits = dbUser.credits
          }
        }
        return session
      },
    },
    pages: {
      signIn: '/login',
      verifyRequest: '/verify',
    },
  })
}

// Singleton для NextAuth
type AuthInstance = ReturnType<typeof createAuth>
const globalForAuth = globalThis as unknown as {
  __authInstance?: AuthInstance
}

export function getAuth(): AuthInstance {
  if (!globalForAuth.__authInstance) {
    globalForAuth.__authInstance = createAuth()
  }
  return globalForAuth.__authInstance
}

export const { auth, signIn, signOut, handlers } = getAuth()
