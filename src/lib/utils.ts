import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "R$ 0,00"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export const TIMEZONE_SP = "America/Sao_Paulo"

export function getTodaySaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_SP,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-"
  const str = dateString.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split("-")
    return `${day}/${month}/${year}`
  }
  try {
    const date = new Date(str)
    if (isNaN(date.getTime())) return str
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE_SP,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date)
  } catch {
    return str
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "-"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE_SP,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  } catch {
    return dateString
  }
}

export function diasRestantesSaoPaulo(dataVencimento: string): number {
  const hojeStr = getTodaySaoPaulo()
  const hoje = new Date(hojeStr + "T00:00:00")
  const dataAlvo = new Date(dataVencimento.split("T")[0] + "T00:00:00")
  return Math.round((dataAlvo.getTime() - hoje.getTime()) / 86400000)
}

export function formatCpfCnpj(value: string | null | undefined): string {
  if (!value) return "-"
  const clean = value.replace(/\D/g, "")
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
  }
  return value
}
