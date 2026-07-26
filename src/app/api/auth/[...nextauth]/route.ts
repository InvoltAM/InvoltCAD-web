import { getAuth } from '@/lib/auth'
import { NextRequest } from 'next/server'

const { handlers } = getAuth()

export async function GET(request: NextRequest) {
  return handlers.GET(request)
}

export async function POST(request: NextRequest) {
  return handlers.POST(request)
}
