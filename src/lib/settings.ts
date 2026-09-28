import { supabase } from '@/lib/supabase'

export interface MoriaSettings {
  gemini_api_key: string
  gemini_model: string
  whatsapp_api_url: string
  whatsapp_api_key: string
  whatsapp_phone: string
  whatsapp_enabled: boolean
}

const DEFAULTS: MoriaSettings = {
  gemini_api_key: "",
  gemini_model: "gemini-3.8-flash",
  whatsapp_api_url: "",
  whatsapp_api_key: "",
  whatsapp_phone: "",
  whatsapp_enabled: false,
}

// Cache local para evitar query repetida no mesmo render
let cache: MoriaSettings | null = null

export async function getSettingsAsync(): Promise<MoriaSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('gemini_api_key, gemini_model, whatsapp_api_url, whatsapp_api_key, whatsapp_phone, whatsapp_enabled')
    .eq('id', 'global')
    .single()
  if (error || !data) return { ...DEFAULTS }
  const settings: MoriaSettings = {
    gemini_api_key: data.gemini_api_key || DEFAULTS.gemini_api_key,
    gemini_model: data.gemini_model || DEFAULTS.gemini_model,
    whatsapp_api_url: data.whatsapp_api_url || DEFAULTS.whatsapp_api_url,
    whatsapp_api_key: data.whatsapp_api_key || DEFAULTS.whatsapp_api_key,
    whatsapp_phone: data.whatsapp_phone || DEFAULTS.whatsapp_phone,
    whatsapp_enabled: data.whatsapp_enabled ?? DEFAULTS.whatsapp_enabled,
  }
  cache = settings
  return settings
}

/** Sync version - retorna cache ou defaults. Usar getSettingsAsync quando possivel. */
export function getSettings(): MoriaSettings {
  return cache ?? { ...DEFAULTS }
}

export async function saveSettings(settings: Partial<MoriaSettings>): Promise<void> {
  const current = await getSettingsAsync()
  const updated = { ...current, ...settings }
  await supabase
    .from('app_settings')
    .upsert({ id: 'global', ...updated, updated_at: new Date().toISOString() })
  cache = updated
}

export async function testGeminiConnection(
  apiKey: string,
  model: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Responda apenas: OK" }] }],
          generationConfig: { maxOutputTokens: 8 },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.json()
      return { ok: false, message: err?.error?.message ?? `Erro HTTP ${res.status}` }
    }
    return { ok: true, message: "Conexão bem-sucedida." }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido"
    return { ok: false, message: msg }
  }
}
