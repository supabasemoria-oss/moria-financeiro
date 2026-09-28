import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      titulo,
      descricao,
      valor,
      vencimento,
      projetoNome,
      link,
      phone,
    } = body

    const { data: settings } = await supabase
      .from('app_settings')
      .select('whatsapp_api_url, whatsapp_phone, whatsapp_enabled, whatsapp_immediate_alerts')
      .eq('id', 'global')
      .single()

    if (!settings?.whatsapp_enabled) {
      return Response.json({ skipped: true, reason: 'WhatsApp desabilitado nas configurações.' })
    }

    if (!settings?.whatsapp_immediate_alerts) {
      return Response.json({ skipped: true, reason: 'Alertas imediatos desativados pelo administrador.' })
    }

    const targetPhone = phone || settings.whatsapp_phone
    const apiUrl = settings.whatsapp_api_url?.trim().replace(/\/+$/, '')

    if (!targetPhone || !apiUrl) {
      return Response.json({ error: 'Telefone ou URL da API não configurados.' }, { status: 400 })
    }

    const valorFormatado =
      typeof valor === 'number'
        ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : valor
        ? `R$ ${valor}`
        : null

    const executionLink = link || 'https://moria-financeiro.vercel.app/lembretes'

    const mensagem =
      `🚨 *Moriá — Alerta Imediato de Pagamento*\n\n` +
      `*Conta:* ${descricao || titulo || 'Nova obrigação cadastrada'}\n\n` +
      (projetoNome ? `*Projeto:* ${projetoNome}\n\n` : '') +
      (valorFormatado ? `*Valor:* ${valorFormatado}\n\n` : '') +
      (vencimento ? `*Vencimento:* ${vencimento}\n\n` : '') +
      `*Executar pagamento agora:*\n${executionLink}`

    const res = await fetch(`${apiUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: targetPhone,
        message: mensagem,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return Response.json({ error: data.error || 'Falha ao enviar mensagem' }, { status: res.status })
    }

    return Response.json({ success: true, messageId: data.messageId })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return Response.json({ error: msg }, { status: 500 })
  }
}
