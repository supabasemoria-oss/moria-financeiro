import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { nome, cargo, role, telefone, ativo, password } = body

    const admin = getSupabaseAdmin()

    // 1. Se informou nova senha ou metadados, atualizar no Supabase Auth
    const authUpdatePayload: any = {}
    if (password && password.trim().length >= 6) {
      authUpdatePayload.password = password.trim()
    }
    const userMeta: Record<string, any> = {}
    if (nome !== undefined) userMeta.name = nome
    if (cargo !== undefined) userMeta.cargo = cargo
    if (role !== undefined) userMeta.role = role
    if (telefone !== undefined) userMeta.telefone = telefone
    if (Object.keys(userMeta).length > 0) {
      authUpdatePayload.user_metadata = userMeta
    }

    if (Object.keys(authUpdatePayload).length > 0) {
      const { error: authError } = await admin.auth.admin.updateUserById(id, authUpdatePayload)
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    }

    // 2. Atualizar tabela public.usuarios
    const tableUpdatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (nome !== undefined) tableUpdatePayload.nome = nome
    if (cargo !== undefined) tableUpdatePayload.cargo = cargo
    if (role !== undefined) tableUpdatePayload.role = role
    if (telefone !== undefined) tableUpdatePayload.telefone = telefone
    if (ativo !== undefined) tableUpdatePayload.ativo = ativo

    const { data, error } = await admin
      .from('usuarios')
      .update(tableUpdatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar usuário'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const admin = getSupabaseAdmin()

    // 1. Deletar do auth.users (cascata removerá de public.usuarios)
    const { error: authError } = await admin.auth.admin.deleteUser(id)
    if (authError) {
      // Se não achar no auth, deleta direto da tabela
      await admin.from('usuarios').delete().eq('id', id)
    } else {
      await admin.from('usuarios').delete().eq('id', id)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir usuário'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
