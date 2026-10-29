import { supabase } from '@/lib/supabase'
import type { CategoriaLembrete } from '@/lib/types'

export interface MoriaSettings {
  gemini_api_key: string
  gemini_model: string
  whatsapp_api_url: string
  whatsapp_api_key: string
  whatsapp_phone: string
  whatsapp_enabled: boolean
  whatsapp_summary_mode: 'hoje' | 'amanha' | 'ambos'
  whatsapp_morning_time: string
  whatsapp_evening_time: string
  whatsapp_immediate_alerts: boolean
  nome_sistema: string
  subtitulo_sistema: string
  logo_url: string | null
}

const DEFAULTS: MoriaSettings = {
  gemini_api_key: "",
  gemini_model: "gemini-3.8-flash",
  whatsapp_api_url: "https://moria-whatsapp.onrender.com",
  whatsapp_api_key: "",
  whatsapp_phone: "",
  whatsapp_enabled: false,
  whatsapp_summary_mode: "ambos",
  whatsapp_morning_time: "08:00",
  whatsapp_evening_time: "18:00",
  whatsapp_immediate_alerts: false,
  nome_sistema: "MROSC Gestão",
  subtitulo_sistema: "MROSC • Lei 13.019",
  logo_url: "/logo-symbol.png",
}

// Cache local para evitar query repetida no mesmo render
let cache: MoriaSettings | null = null

export async function getSettingsAsync(): Promise<MoriaSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
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
    whatsapp_summary_mode: (data.whatsapp_summary_mode as any) || DEFAULTS.whatsapp_summary_mode,
    whatsapp_morning_time: data.whatsapp_morning_time || DEFAULTS.whatsapp_morning_time,
    whatsapp_evening_time: data.whatsapp_evening_time || DEFAULTS.whatsapp_evening_time,
    whatsapp_immediate_alerts: data.whatsapp_immediate_alerts ?? DEFAULTS.whatsapp_immediate_alerts,
    nome_sistema: (data as any).nome_sistema || DEFAULTS.nome_sistema,
    subtitulo_sistema: (data as any).subtitulo_sistema || DEFAULTS.subtitulo_sistema,
    logo_url: (data as any).logo_url || DEFAULTS.logo_url,
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
  await (supabase.from('app_settings') as any)
    .upsert({ id: 'global', ...updated, updated_at: new Date().toISOString() })
  cache = updated
}

export async function uploadSystemLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const fileName = `logo_${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(fileName, file, { upsert: true, cacheControl: '3600' })
  if (uploadError) throw new Error(uploadError.message)

  const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
  return data.publicUrl
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

// =========================================================================
// Categorias de Lembretes & Alertas (Gerenciáveis via ID)
// =========================================================================

export const CATEGORIAS_PADRAO_LEMBRETES: CategoriaLembrete[] = [
  { id: "RH", label: "Recursos Humanos (RH)", icon: "👥", geraLembrete: true, isDefault: true },
  { id: "SERVICO", label: "Serviços de Terceiros", icon: "🛠️", geraLembrete: false, isDefault: true },
  { id: "MATERIAL", label: "Compra de Materiais", icon: "📦", geraLembrete: false, isDefault: true },
  { id: "LOCACAO", label: "Locações de Bens e Espaços", icon: "🏢", geraLembrete: false, isDefault: true },
  { id: "OUTROS", label: "Outros / Encargos", icon: "📑", geraLembrete: false, isDefault: true },
]

let categoriasCache: CategoriaLembrete[] | null = null

export async function getCategoriasLembretesAsync(): Promise<CategoriaLembrete[]> {
  if (categoriasCache) return categoriasCache

  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem("moria_categorias_lembretes")
      if (local) {
        categoriasCache = JSON.parse(local)
      }
    } catch {}
  }

  try {
    const { data, error } = await supabase.storage.from("logos").download("categorias_lembretes.json")
    if (!error && data) {
      const text = await data.text()
      const parsed: CategoriaLembrete[] = JSON.parse(text)
      if (Array.isArray(parsed) && parsed.length > 0) {
        categoriasCache = parsed
        if (typeof window !== "undefined") {
          localStorage.setItem("moria_categorias_lembretes", JSON.stringify(parsed))
        }
        return parsed
      }
    }
  } catch {}

  if (!categoriasCache) {
    categoriasCache = CATEGORIAS_PADRAO_LEMBRETES
  }
  return categoriasCache
}

export async function saveCategoriasLembretes(categorias: CategoriaLembrete[]): Promise<void> {
  categoriasCache = categorias
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("moria_categorias_lembretes", JSON.stringify(categorias))
    } catch {}
  }

  try {
    const blob = new Blob([JSON.stringify(categorias, null, 2)], { type: "application/json" })
    await supabase.storage.from("logos").upload("categorias_lembretes.json", blob, {
      upsert: true,
      cacheControl: "60",
    })
  } catch (err) {
    console.warn("Aviso ao salvar categorias no Storage:", err)
  }
}

export function getCategoriasLembretesSync(): CategoriaLembrete[] {
  if (categoriasCache) return categoriasCache
  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem("moria_categorias_lembretes")
      if (local) {
        categoriasCache = JSON.parse(local)
        return categoriasCache!
      }
    } catch {}
  }
  return CATEGORIAS_PADRAO_LEMBRETES
}
