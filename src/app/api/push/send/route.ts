import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY!
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

webpush.setVapidDetails('mailto:ti@moria.org.br', VAPID_PUBLIC, VAPID_PRIVATE)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  return handleDispatch(searchParams)
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  let body: any = {}
  try {
    body = await req.json()
  } catch {}
  return handleDispatch(searchParams, body)
}

async function handleDispatch(searchParams: URLSearchParams, body: any = {}) {
  const requestedType = searchParams.get('type') || body.type || 'auto'
  const isCron = searchParams.get('cron') === 'true'
  const isTest = searchParams.get('test') === 'true'
  const overridePhone = body.phone

  // Obter datas no fuso horário oficial de São Paulo
  const agoraSP = new Date()
  const hojeSt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agoraSP)

  const horaAtual = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(agoraSP)

  const amanha = new Date(hojeSt + 'T12:00:00')
  amanha.setDate(amanha.getDate() + 1)
  const amanhaSt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(amanha)

  const limite7 = new Date(hojeSt + 'T12:00:00')
  limite7.setDate(limite7.getDate() + 7)
  const limite7St = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(limite7)

  // Carregar configuracoes
  const { data: settings } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'global')
    .single()

  const waEnabled = settings?.whatsapp_enabled ?? false
  const waUrl = settings?.whatsapp_api_url?.trim().replace(/\/+$/, '')
  const waPhone = overridePhone || settings?.whatsapp_phone
  const summaryMode = settings?.whatsapp_summary_mode || 'ambos'
  const morningTime = settings?.whatsapp_morning_time || '08:00'
  const eveningTime = settings?.whatsapp_evening_time || '18:00'
  const lastMorning = settings?.whatsapp_last_morning_sent
  const lastEvening = settings?.whatsapp_last_evening_sent

  // Se chamado por rotina cron de checagem horária
  let activeType = requestedType
  if (isCron && requestedType === 'auto') {
    const isMorningWindow = isTimeMatch(horaAtual, morningTime)
    const isEveningWindow = isTimeMatch(horaAtual, eveningTime)

    if ((summaryMode === 'hoje' || summaryMode === 'ambos') && isMorningWindow && lastMorning !== hojeSt) {
      activeType = 'morning'
    } else if ((summaryMode === 'amanha' || summaryMode === 'ambos') && isEveningWindow && lastEvening !== hojeSt) {
      activeType = 'evening'
    } else {
      // Fora das janelas de horário ou já enviado hoje
      return Response.json({
        skipped: true,
        reason: 'Fora do horário agendado ou resumo já enviado hoje',
        horaAtual,
        morningTime,
        eveningTime,
      })
    }
  }

  // Buscar parcelas pendentes
  const { data: parcelas } = await supabase
    .from('parcelas_pagamento')
    .select('id, descricao, data_vencimento, valor_previsto, status, projetos(nome)')
    .lte('data_vencimento', limite7St)
    .neq('status', 'PAGO')
    .neq('status', 'CANCELADO')

  // Buscar lembretes avulsos
  const { data: lembretes } = await supabase
    .from('lembretes_avulsos')
    .select('id, titulo, data_vencimento, valor')
    .lte('data_vencimento', limite7St)
    .eq('status', 'PENDENTE')

  const todasParcelas = parcelas ?? []
  const todosLembretes = lembretes ?? []

  const atrasadas = todasParcelas.filter(p => p.data_vencimento < hojeSt)
  const hojeList = todasParcelas.filter(p => p.data_vencimento === hojeSt)
  const amanhaList = todasParcelas.filter(p => p.data_vencimento === amanhaSt)
  const proximas7 = todasParcelas.filter(p => p.data_vencimento > amanhaSt && p.data_vencimento <= limite7St)

  const lembretesAtrasados = todosLembretes.filter(l => l.data_vencimento < hojeSt)
  const lembretesHoje = todosLembretes.filter(l => l.data_vencimento === hojeSt)
  const lembretesAmanha = todosLembretes.filter(l => l.data_vencimento === amanhaSt)

  // Montar mensagem de acordo com o tipo solicitado
  let whatsappSent = false
  let whatsappError: string | null = null

  if (waEnabled && waUrl && waPhone) {
    let msg = ''

    if (activeType === 'evening') {
      // Resumo Antecipado de Amanhã (D-1)
      const totalAmanha = amanhaList.length + lembretesAmanha.length
      const valorAmanha = amanhaList.reduce((acc, p) => acc + (p.valor_previsto || 0), 0)

      msg = `🌙 *Moriá Financeiro — Resumo Antecipado de Amanhã*\n` +
        `📅 *Planejamento para:* ${formatarDataBR(amanhaSt)}\n\n`

      if (totalAmanha === 0 && atrasadas.length === 0) {
        msg += `✅ Nenhuma conta prevista para vencer amanhã! Todas as obrigações em dia.\n`
      } else {
        if (totalAmanha > 0) {
          msg += `📋 *Contas com vencimento amanhã:* ${totalAmanha}\n`
          if (valorAmanha > 0) {
            msg += `💰 *Total previsto:* ${formatarMoeda(valorAmanha)}\n`
          }
          msg += `\n*Detalhamento:*\n`
          for (const p of amanhaList.slice(0, 8)) {
            const proj = (p.projetos as any)?.nome ? `[${(p.projetos as any).nome}] ` : ''
            msg += `• ${proj}${p.descricao} — *${formatarMoeda(p.valor_previsto)}*\n`
          }
          for (const l of lembretesAmanha.slice(0, 4)) {
            msg += `• 🔔 ${l.titulo}${l.valor ? ` — *${formatarMoeda(l.valor)}*` : ''}\n`
          }
          msg += `\n`
        }

        if (atrasadas.length > 0) {
          const valorAtrasadas = atrasadas.reduce((acc, p) => acc + (p.valor_previsto || 0), 0)
          msg += `⚠️ *Atenção:* Existem *${atrasadas.length}* conta(s) pendente(s) em atraso (${formatarMoeda(valorAtrasadas)}).\n\n`
        }
      }

      msg += `🔗 *Acesse o painel para executar os pagamentos:*\nhttps://moria-financeiro.vercel.app/lembretes`

    } else if (activeType === 'morning' || activeType === 'auto') {
      // Resumo do Dia Presente (D0)
      const totalHoje = hojeList.length + lembretesHoje.length
      const valorHoje = hojeList.reduce((acc, p) => acc + (p.valor_previsto || 0), 0)

      msg = `☀️ *Moriá Financeiro — Resumo de Vencimentos de Hoje*\n` +
        `📅 *Data:* ${formatarDataBR(hojeSt)}\n\n`

      if (totalHoje === 0 && atrasadas.length === 0) {
        msg += `✅ Não há contas vencendo hoje. Dia tranquilo!\n`
      } else {
        if (totalHoje > 0) {
          msg += `🎯 *Contas que vencem HOJE:* ${totalHoje}\n`
          if (valorHoje > 0) {
            msg += `💰 *Total a pagar hoje:* ${formatarMoeda(valorHoje)}\n`
          }
          msg += `\n*Obrigações do dia:*\n`
          for (const p of hojeList.slice(0, 8)) {
            const proj = (p.projetos as any)?.nome ? `[${(p.projetos as any).nome}] ` : ''
            msg += `• ${proj}${p.descricao} — *${formatarMoeda(p.valor_previsto)}*\n`
          }
          for (const l of lembretesHoje.slice(0, 4)) {
            msg += `• 🔔 ${l.titulo}${l.valor ? ` — *${formatarMoeda(l.valor)}*` : ''}\n`
          }
          msg += `\n`
        }

        if (atrasadas.length > 0) {
          const valorAtrasadas = atrasadas.reduce((acc, p) => acc + (p.valor_previsto || 0), 0)
          msg += `⚠️ *Atrasadas:* ${atrasadas.length} parcela(s) pendente(s) (${formatarMoeda(valorAtrasadas)}).\n\n`
        }
      }

      msg += `🔗 *Executar baixas e pagamentos agora:*\nhttps://moria-financeiro.vercel.app/lembretes`

    } else {
      // Teste simples
      msg = `🔔 *Moriá Financeiro — Teste de Conexão WhatsApp*\n\n` +
        `Conexão estabelecida com sucesso com o microserviço Baileys no Render.\n` +
        `Data e Hora: ${formatarDataBR(hojeSt)} às ${horaAtual}\n\n` +
        `🔗 Painel de Lembretes: https://moria-financeiro.vercel.app/lembretes`
    }

    try {
      const waRes = await fetch(`${waUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: waPhone,
          message: msg,
        }),
      })

      if (waRes.ok) {
        whatsappSent = true
        // Registrar envio no banco para não repetir no mesmo dia
        if (isCron && !isTest) {
          if (activeType === 'morning') {
            await supabase.from('app_settings').update({ whatsapp_last_morning_sent: hojeSt }).eq('id', 'global')
          } else if (activeType === 'evening') {
            await supabase.from('app_settings').update({ whatsapp_last_evening_sent: hojeSt }).eq('id', 'global')
          }
        }
      } else {
        const errJson = await waRes.json().catch(() => ({}))
        whatsappError = errJson?.error || `HTTP ${waRes.status}`
      }
    } catch (err: unknown) {
      whatsappError = err instanceof Error ? err.message : 'Falha ao conectar com serviço WhatsApp'
    }
  }

  // Notificações WebPush no Navegador
  const { data: subscriptions } = await supabase.from('push_subscriptions').select('*')
  let webPushSent = 0
  const expired: string[] = []

  if (subscriptions?.length) {
    const totalItens = atrasadas.length + hojeList.length + amanhaList.length
    const payload = JSON.stringify({
      title: `Moriá — ${totalItens} item(ns) pendente(s)`,
      body: `Hoje: ${hojeList.length} | Amanhã: ${amanhaList.length} | Atrasadas: ${atrasadas.length}`,
      url: '/lembretes',
      tag: 'moria-diario',
    })

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        webPushSent++
      } catch (e: unknown) {
        if (e && typeof e === 'object' && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
          expired.push(sub.endpoint)
        }
      }
    }

    if (expired.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expired)
    }
  }

  return Response.json({
    success: true,
    activeType,
    whatsappSent,
    whatsappError,
    webPushSent,
    expiredSubscriptions: expired.length,
  })
}

function isTimeMatch(current: string, target: string): boolean {
  if (!current || !target) return false
  const [curH, curM] = current.split(':').map(Number)
  const [tarH, tarM] = target.split(':').map(Number)
  const diffMinutes = Math.abs((curH * 60 + curM) - (tarH * 60 + tarM))
  return diffMinutes <= 15
}

function formatarDataBR(dataIso: string): string {
  if (!dataIso) return ''
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarMoeda(valor: number): string {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
