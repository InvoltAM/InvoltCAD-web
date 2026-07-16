import { getAuth } from '@/lib/auth'

export async function GET(request: Request) {
  const { handlers } = getAuth()
  return handlers.GET(request)
}

export async function POST(request: Request) {
  const { handlers } = getAuth()
  return handlers.POST(request)
}
