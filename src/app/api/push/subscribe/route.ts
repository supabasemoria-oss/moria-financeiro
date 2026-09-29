import type { PushSubscription } from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
  return createClient(url, key)
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const { subscription } = body as { subscription: PushSubscription }

  if (!subscription?.endpoint) {
    return Response.json({ error: 'Subscription inválida' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    user_agent: req.headers.get('user-agent') ?? '',
  }, { onConflict: 'endpoint' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = getSupabase()
  const { endpoint } = await req.json()
  if (!endpoint) return Response.json({ error: 'endpoint obrigatório' }, { status: 400 })
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return Response.json({ ok: true })
}
