const express = require('express')
const cors = require('cors')
const QRCode = require('qrcode')
const pino = require('pino')
const path = require('path')
const fs = require('fs')
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys')

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys')

let sock = null
let currentQR = null
let isConnected = false
let connectedUser = null
let isConnecting = false

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' })

async function connectToWhatsApp() {
  if (isConnecting) return
  isConnecting = true

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: ['Moria Financeiro', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        try {
          currentQR = await QRCode.toDataURL(qr)
        } catch (e) {
          console.error('Erro ao converter QR:', e)
        }
      }

      if (connection === 'open') {
        isConnected = true
        currentQR = null
        isConnecting = false
        connectedUser = sock?.user?.id ? sock.user.id.split(':')[0] : 'Conectado'
        console.log('[WhatsApp] Conexao estabelecida com sucesso!')
      }

      if (connection === 'close') {
        isConnected = false
        connectedUser = null
        isConnecting = false

        const statusCode = lastDisconnect?.error?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        console.log(`[WhatsApp] Conexao encerrada. Reconectar? ${shouldReconnect} (codigo: ${statusCode})`)

        if (statusCode === DisconnectReason.loggedOut) {
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true })
          } catch {}
          currentQR = null
        }

        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 5000)
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
// Rotas da API
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

// QR Code para frontend renderizar
app.get('/qr', (req, res) => {
  res.json({
    connected: isConnected,
    qr: currentQR,
    user: connectedUser,
  })
})

// Disparar mensagem de lembrete
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

    // Padronizar formato Brasil (DDI 55)
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

  isConnected = false
  connectedUser = null
  currentQR = null

  setTimeout(connectToWhatsApp, 2000)

  res.json({ success: true, message: 'Sessao desconectada. Novo QR gerado.' })
})

app.listen(PORT, () => {
  console.log(`[WhatsApp Microservice] Rodando na porta ${PORT}`)
})
