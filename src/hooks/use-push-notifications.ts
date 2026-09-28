"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

type Status = "idle" | "granted" | "denied" | "unsupported"

export function usePushNotifications() {
  const [status, setStatus] = useState<Status>("idle")
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [swReady, setSwReady] = useState(false)

  // Registrar service worker
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported")
      return
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        setSwReady(true)
        // Verificar se já está subscrito
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          setSubscription(existing)
          setStatus("granted")
        } else {
          setStatus(Notification.permission === "denied" ? "denied" : "idle")
        }
      })
      .catch(() => setStatus("unsupported"))
  }, [])

  const subscribe = useCallback(async () => {
    if (!swReady) return
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus("denied")
        toast.error("Permissão de notificação negada.")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as unknown as BufferSource,
      })
      setSubscription(sub)
      setStatus("granted")
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      })
      toast.success("Notificações push ativadas!")
    } catch (e) {
      toast.error("Erro ao ativar notificações.")
      console.error(e)
    }
  }, [swReady])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return
    try {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      await subscription.unsubscribe()
      setSubscription(null)
      setStatus("idle")
      toast.success("Notificações push desativadas.")
    } catch (e) {
      toast.error("Erro ao desativar notificações.")
      console.error(e)
    }
  }, [subscription])

  return { status, subscribe, unsubscribe, isSupported: status !== "unsupported" }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)))
}
