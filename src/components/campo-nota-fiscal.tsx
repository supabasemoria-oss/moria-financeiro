"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FileTextIcon, UploadIcon, XIcon } from "lucide-react"

interface CampoNotaFiscalProps {
  numero: string
  onNumeroChange: (numero: string) => void
  arquivo: File | null
  onArquivoChange: (file: File | null) => void
  labelNumero?: string
  placeholderNumero?: string
  disabled?: boolean
  className?: string
  idInput?: string
}

export function CampoNotaFiscal({
  numero,
  onNumeroChange,
  arquivo,
  onArquivoChange,
  labelNumero = "Nº Nota Fiscal / Comprovante",
  placeholderNumero = "Ex: NF 10423",
  disabled = false,
  className = "",
  idInput = "nf-file-upload",
}: CampoNotaFiscalProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    onArquivoChange(file)
  }

  const handleRemoverArquivo = () => {
    onArquivoChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="grid gap-1.5">
        <Label htmlFor={idInput} className="text-xs font-medium text-foreground">
          {labelNumero}
        </Label>
        <Input
          type="text"
          placeholder={placeholderNumero}
          value={numero}
          onChange={(e) => onNumeroChange(e.target.value)}
          disabled={disabled}
          className="text-xs"
        />
      </div>

      <div className="rounded-lg border border-dashed p-2.5 bg-muted/20">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="hidden"
          id={idInput}
          disabled={disabled}
        />

        {arquivo ? (
          <div className="flex items-center justify-between gap-2 bg-background p-2 rounded-md border text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <FileTextIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate text-xs">
                  {arquivo.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(arquivo.size / 1024).toFixed(1)} KB • Arquivo pronto para anexar
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleRemoverArquivo}
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
              title="Remover anexo"
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              Anexo digital (PDF, JPG, PNG - opcional)
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="h-6 text-[11px] px-2 gap-1.5 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
            >
              <UploadIcon className="size-3" />
              Anexar Arquivo
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
