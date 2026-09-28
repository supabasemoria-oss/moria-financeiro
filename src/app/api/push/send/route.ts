import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY!
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

webpush.setVapidDetails('mailto:ti@moria.org.br', VAPID_PUBLIC, VAPID_PRIVATE)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Chamado por cron (ex: diariamente às 8h) OU diretamente em /api/push/send
export async function GET() {
  return sendPushNotifications()
}
export async function POST() {
  return sendPushNotifications()
}

async function sendPushNotifications() {
  const hojeSt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const hoje = new Date(hojeSt + 'T12:00:00')
  const limite7 = new Date(hoje)
  limite7.setDate(hoje.getDate() + 7)
  const limite7St = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(limite7)

  // Buscar parcelas vencendo em 7 dias ou atrasadas
  const { data: parcelas } = await supabase
    .from('parcelas_pagamento')
    .select('descricao, data_vencimento, status, projetos(nome)')
    .lte('data_vencimento', limite7St)
    .neq('status', 'PAGO')
    .neq('status', 'CANCELADO')

  // Buscar lembretes avulsos vencendo em 7 dias ou atrasados
  const { data: lembretes } = await supabase
    .from('lembretes_avulsos')
    .select('titulo, data_vencimento')
    .lte('data_vencimento', limite7St)
    .eq('status', 'PENDENTE')

  if (!parcelas?.length && !lembretes?.length) {
    return Response.json({ sent: 0, message: 'Nada a notificar' })
  }

  const atrasadas = (parcelas ?? []).filter(p => p.data_vencimento < hojeSt)
  const vencem7 = (parcelas ?? []).filter(p => p.data_vencimento >= hojeSt)
  const lembretesAtrasados = (lembretes ?? []).filter(l => l.data_vencimento < hojeSt)
  const lembretesVencem = (lembretes ?? []).filter(l => l.data_vencimento >= hojeSt)

  const totalPendentes = atrasadas.length + vencem7.length + lembretesAtrasados.length + lembretesVencem.length

  const linhas: string[] = []
  if (atrasadas.length) linhas.push(`⚠️ ${atrasadas.length} parcela(s) atrasada(s)`)
  if (vencem7.length) linhas.push(`📅 ${vencem7.length} parcela(s) vencem nos próximos 7 dias`)
  if (lembretesAtrasados.length) linhas.push(`🔔 ${lembretesAtrasados.length} lembrete(s) atrasado(s)`)
  if (lembretesVencem.length) linhas.push(`📋 ${lembretesVencem.length} lembrete(s) vencem em breve`)

  const payload = JSON.stringify({
    title: `Moriá — ${totalPendentes} item(ns) pendente(s)`,
    body: linhas.join('\n'),
    url: '/lembretes',
    tag: 'moria-diario',
  })

  // Buscar todas as subscriptions
  const { data: subscriptions } = await supabase.from('push_subscriptions').select('*')
  if (!subscriptions?.length) return Response.json({ sent: 0, message: 'Sem subscriptions' })

  let sent = 0
  const expired: string[] = []

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (e: unknown) {
      // 410 = subscription expirada
      if (e && typeof e === 'object' && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
        expired.push(sub.endpoint)
      }
    }
  }

  // Remover subscriptions expiradas
  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired)
  }

  return Response.json({ sent, expired: expired.length })
}
