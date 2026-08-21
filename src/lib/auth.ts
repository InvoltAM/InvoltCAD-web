import { PrismaAdapter } from '@auth/prisma-adapter'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Email from 'next-auth/providers/email'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'
const isDev = process.env.NODE_ENV === 'development'

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

  // Тестовый вход только в dev-режиме
  if (isDev) {
    providers.push(
      Credentials({
        name: 'test',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Пароль', type: 'password' },
        },
        async authorize(credentials) {
          if (credentials?.password !== 'password') return null
          const email = (credentials?.email as string)?.trim().toLowerCase() || 'admin@example.com'
          let user = await prisma.user.findUnique({ where: { email } })
          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: email.split('@')[0] || 'Test User',
                role: 'admin',
                credits: 1000,
              },
            })
          }
          return { id: user.id, email: user.email ?? email, name: user.name, image: user.image }
        },
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
      strategy: 'jwt',
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.sub = user.id
          token.email = user.email
          token.name = user.name
          token.picture = user.image
        }
        return token
      },
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub
          // Загружаем роль и кредиты из БД
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
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
