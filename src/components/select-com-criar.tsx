"use client"
import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircleIcon } from "lucide-react"

export interface OpcaoSelect { id: string; label: string }

interface Props {
  value: string
  onValueChange: (val: string) => void
  opcoes: OpcaoSelect[]
  placeholder?: string
  labelCriar: string
  onClickCriar: () => void
  id?: string
  disabled?: boolean
}

export function SelectComCriar({ value, onValueChange, opcoes, placeholder, labelCriar, onClickCriar, id, disabled }: Props) {
  return (
    <div className="grid gap-1">
      <Select value={value} onValueChange={v => v && onValueChange(v)} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder ?? "Selecione..."} />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={onClickCriar}
        className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-500 w-fit"
      >
        <PlusCircleIcon className="size-3" />
        {opcoes.length === 0 ? `Nenhum cadastrado — ${labelCriar}` : labelCriar}
      </button>
    </div>
  )
}