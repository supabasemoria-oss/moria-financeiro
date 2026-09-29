/**
 * Utilitários de Máscaras e Formatação de Entradas no Sistema Moriá
 */

export function onlyDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  return String(value).replace(/\D/g, "")
}

/**
 * Máscara de Moeda (BRL) para campos de entrada.
 * Converte valor numérico ou digitado para o formato padrão "120.000,00".
 */
export function maskCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""

  if (typeof value === "number") {
    if (isNaN(value)) return ""
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const str = String(value).trim()
  if (!str) return ""

  // Caso string venha pura de API/Banco ("120000" ou "120000.50")
  if (!str.includes(",") && /^\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str)
    if (!isNaN(num)) {
      return num.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
  }

  const digits = str.replace(/\D/g, "")
  if (!digits) return ""

  const cents = parseInt(digits, 10) / 100
  return cents.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Converte string mascarada de moeda (ex: "120.000,00") para número (120000).
 */
export function parseCurrency(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0
  if (typeof value === "number") return isNaN(value) ? 0 : value

  const clean = String(value).trim()
  if (!clean) return 0

  if (clean.includes(",")) {
    const digits = clean.replace(/\D/g, "")
    if (!digits) return 0
    return parseInt(digits, 10) / 100
  }

  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

/**
 * Máscara CNPJ: 00.000.000/0000-00
 */
export function maskCnpj(value: string | null | undefined): string {
  if (!value) return ""
  const digits = value.replace(/\D/g, "").slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

/**
 * Máscara CPF: 000.000.000-00
 */
export function maskCpf(value: string | null | undefined): string {
  if (!value) return ""
  const digits = value.replace(/\D/g, "").slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2")
}

/**
 * Máscara dinâmica CPF (até 11 dígitos) ou CNPJ (até 14 dígitos)
 */
export function maskCpfCnpj(value: string | null | undefined): string {
  if (!value) return ""
  const digits = value.replace(/\D/g, "").slice(0, 14)
  if (digits.length <= 11) {
    return maskCpf(digits)
  }
  return maskCnpj(digits)
}

/**
 * Máscara Telefone: (00) 0000-0000 ou (00) 00000-0000
 */
export function maskTelefone(value: string | null | undefined): string {
  if (!value) return ""
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
}

/**
 * Máscara CEP: 00000-000
 */
export function maskCep(value: string | null | undefined): string {
  if (!value) return ""
  const digits = value.replace(/\D/g, "").slice(0, 8)
  return digits.replace(/^(\d{5})(\d)/, "$1-$2")
}
