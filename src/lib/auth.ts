import { PrismaAdapter } from '@auth/prisma-adapter'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Email from 'next-auth/providers/email'
import { prisma } from './prisma'

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

function createAuth() {
  const providers: any[] = [
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
const globalForAuth = globalThis as unknown as {
  auth: ReturnType<typeof createAuth> | undefined
}

export function getAuth() {
  if (!globalForAuth.auth) {
    globalForAuth.auth = createAuth()
  }
  return globalForAuth.auth
}

export const auth: ReturnType<typeof createAuth>['auth'] = async (...args: any[]) => {
  return getAuth().auth(...args)
}

export const signIn: ReturnType<typeof createAuth>['signIn'] = async (...args: any[]) => {
  return getAuth().signIn(...args)
}

export const signOut: ReturnType<typeof createAuth>['signOut'] = async (...args: any[]) => {
  return getAuth().signOut(...args)
}
