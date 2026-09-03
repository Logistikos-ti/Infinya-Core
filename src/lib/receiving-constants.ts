// Constantes de Recebimento seguras pro client — sem NENHUM import de código
// server-only (createSupabaseServerClient usa next/headers, que quebra o
// build se um componente "use client" importar de src/lib/receiving.ts,
// mesmo que só precise de uma constante). Mantido separado por isso.
export const RECEIVING_DOCK_OPTIONS = ["DOCA-01", "DOCA-02", "DOCA-03"] as const;
