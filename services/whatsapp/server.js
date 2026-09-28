const express = require('express')
const cors = require('cors')
const QRCode = require('qrcode')
const pino = require('pino')
const path = require('path')
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys')

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys')
const SESSION_ID = 'moria_primary_session'

// Supabase para persistencia permanente de sessao
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null

let sock = null
let currentQR = null
let isConnected = false
let connectedUser = null
let isConnecting = false

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' })

// ---------------------------------------------------------------------------
// Persistencia da Sessao no Supabase Postgres
// ---------------------------------------------------------------------------

async function restoreSessionFromSupabase() {
  if (!supabase) {
    console.log('[WhatsApp] Variaveis do Supabase nao configuradas. Usando apenas disco local.')
    return
  }

  try {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('data')
      .eq('id', SESSION_ID)
      .single()

    if (error || !data || !data.data) {
      console.log('[WhatsApp] Nenhuma sessao anterior encontrada no Supabase.')
      return
    }

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true })
    }

    const files = data.data
    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(AUTH_DIR, filename)
      fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content))
    }
    console.log(`[WhatsApp] Sessao restaurada com sucesso do Supabase (${Object.keys(files).length} arquivos).`)
  } catch (err) {
    console.error('[WhatsApp] Falha ao restaurar sessao do Supabase:', err)
  }
}

let syncTimeout = null
function queueSessionSync() {
  if (!supabase) return
  if (syncTimeout) clearTimeout(syncTimeout)

  syncTimeout = setTimeout(async () => {
    try {
      if (!fs.existsSync(AUTH_DIR)) return
      const fileNames = fs.readdirSync(AUTH_DIR)
      const filesMap = {}

      for (const name of fileNames) {
        const fullPath = path.join(AUTH_DIR, name)
        if (fs.statSync(fullPath).isFile()) {
          filesMap[name] = fs.readFileSync(fullPath, 'utf-8')
        }
      }

      await supabase.from('whatsapp_sessions').upsert({
        id: SESSION_ID,
        data: filesMap,
        updated_at: new Date().toISOString(),
      })
      console.log(`[WhatsApp] Sessao persistida com sucesso no Supabase (${fileNames.length} arquivos).`)
    } catch (err) {
      console.error('[WhatsApp] Erro ao salvar sessao no Supabase:', err)
    }
  }, 2000)
}

async function clearSessionInSupabase() {
  if (!supabase) return
  try {
    await supabase.from('whatsapp_sessions').delete().eq('id', SESSION_ID)
    console.log('[WhatsApp] Sessao removida do Supabase.')
  } catch (err) {
    console.error('[WhatsApp] Erro ao remover sessao do Supabase:', err)
  }
}

// ---------------------------------------------------------------------------
// Conexao Baileys com WhatsApp
// ---------------------------------------------------------------------------

async function connectToWhatsApp() {
  if (isConnecting) return
  isConnecting = true

  try {
    // 1. Restaurar sessao do banco antes de iniciar o Baileys
    await restoreSessionFromSupabase()

    // 2. Inicializar estado de autenticacao
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()

    // 3. Criar socket com configuracoes estaveis
    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.macOS('Desktop'), // Assinatura estavel (WhatsApp Web no macOS)
      keepAliveIntervalMs: 25000,         // Keep-alive a cada 25 segundos para evitar timeout 408
      syncFullHistory: false,             // Economizar memoria e evitar overhead de sincronizacao
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
    })

    // Sincronizar credenciais no disco e no banco Supabase
    sock.ev.on('creds.update', async () => {
      await saveCreds()
      queueSessionSync()
    })

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        try {
          currentQR = await QRCode.toDataURL(qr)
        } catch (e) {
          console.error('[WhatsApp] Erro ao converter QR para base64:', e)
        }
      }

      if (connection === 'open') {
        isConnected = true
        currentQR = null
        isConnecting = false
        connectedUser = sock?.user?.id ? sock.user.id.split(':')[0] : 'Conectado'
        console.log(`[WhatsApp] Conectado com sucesso como: ${connectedUser}`)
        queueSessionSync()
      }

      if (connection === 'close') {
        isConnected = false
        connectedUser = null
        isConnecting = false

        const statusCode = lastDisconnect?.error?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        console.log(`[WhatsApp] Conexao fechada (codigo: ${statusCode}). Reconectar? ${shouldReconnect}`)

        if (statusCode === DisconnectReason.loggedOut) {
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true })
          } catch {}
          currentQR = null
          await clearSessionInSupabase()
        }

        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 3000)
        }
      }
    })
  } catch (error) {
    console.error('[WhatsApp] Erro na inicializacao:', error)
    isConnecting = false
    setTimeout(connectToWhatsApp, 5000)
  }
}

// Inicializar na subida do servidor
connectToWhatsApp()

// ---------------------------------------------------------------------------
// Rotas da API HTTP
// ---------------------------------------------------------------------------

// Status da conexao
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    user: connectedUser,
    hasQR: !!currentQR,
    timestamp: new Date().toISOString(),
  })
})

// QR Code para renderizar no frontend
app.get('/qr', (req, res) => {
  res.json({
    connected: isConnected,
    qr: currentQR,
    user: connectedUser,
  })
})

// Disparar mensagem
app.post('/send', async (req, res) => {
  const { number, phone, text, message } = req.body
  const rawNumber = number || phone
  const rawText = text || message

  if (!rawNumber || !rawText) {
    return res.status(400).json({ error: 'Campos number/phone e text/message sao obrigatorios.' })
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ error: 'WhatsApp nao conectado. Leia o QR Code primeiro.' })
  }

  try {
    let clean = String(rawNumber).replace(/\D/g, '')

    // Padronizar formato Brasil com DDI 55
    if (clean.length === 10 || clean.length === 11) {
      clean = '55' + clean
    }

    const jid = `${clean}@s.whatsapp.net`
    const result = await sock.sendMessage(jid, { text: rawText })

    return res.json({
      success: true,
      messageId: result?.key?.id,
      to: clean,
    })
  } catch (error) {
    console.error('[WhatsApp] Falha ao enviar mensagem:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha interna ao enviar mensagem.',
    })
  }
})

// Desconectar sessao
app.post('/logout', async (req, res) => {
  try {
    if (sock) {
      await sock.logout()
    }
  } catch {}

  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true })
  } catch {}

  await clearSessionInSupabase()

  isConnected = false
  connectedUser = null
  currentQR = null

  setTimeout(connectToWhatsApp, 2000)

  res.json({ success: true, message: 'Sessao desconectada. Novo QR gerado.' })
})

app.listen(PORT, () => {
  console.log(`[WhatsApp Microservice] Rodando na porta ${PORT}`)
})
