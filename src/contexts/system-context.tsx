"use client"

import * as React from "react"
import { getSettingsAsync, type MoriaSettings } from "@/lib/settings"

interface SystemContextType {
  settings: MoriaSettings | null
  loading: boolean
  refreshSettings: () => Promise<void>
}

const SystemContext = React.createContext<SystemContextType>({
  settings: null,
  loading: true,
  refreshSettings: async () => {},
})

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<MoriaSettings | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refreshSettings = React.useCallback(async () => {
    try {
      const data = await getSettingsAsync()
      setSettings(data)
    } catch {
      // silencioso se erro
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refreshSettings()

    // Listener para sincronização instantânea entre componentes
    const handleUpdate = () => refreshSettings()
    window.addEventListener("system_settings_updated", handleUpdate)
    return () => {
      window.removeEventListener("system_settings_updated", handleUpdate)
    }
  }, [refreshSettings])

  return (
    <SystemContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SystemContext.Provider>
  )
}

export function useSystemSettings() {
  return React.useContext(SystemContext)
}
