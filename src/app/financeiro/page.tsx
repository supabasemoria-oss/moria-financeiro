import { redirect } from "next/navigation"

export default async function FinanceiroPage(props: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await props.searchParams
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  ).toString()

  redirect(query ? `/execucao?${query}` : "/execucao")
}
