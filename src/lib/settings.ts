const SETTINGS_KEY = "moria_settings"

export interface MoriaSettings {
  gemini_api_key: string
  gemini_model: string
}

const DEFAULTS: MoriaSettings = {
  gemini_api_key: "",
  gemini_model: "gemini-3.8-flash",
}

export function getSettings(): MoriaSettings {
  if (typeof window === "undefined") return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULTS }
}

export function saveSettings(settings: Partial<MoriaSettings>): void {
  if (typeof window === "undefined") return
  const current = getSettings()
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...current, ...settings })
  )
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
      return {
        ok: false,
        message: err?.error?.message ?? `Erro HTTP ${res.status}`,
      }
    }
    return { ok: true, message: "Conexão bem-sucedida." }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido"
    return { ok: false, message: msg }
  }
}
