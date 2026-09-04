/**
 * A single .in() call with hundreds of UUIDs produces a request URL long
 * enough for PostgREST to reject outright with a bare "Bad Request" once
 * the id list grows past a few hundred entries (first hit in the
 * financeiro extrato once it started fetching every lançamento instead of
 * just the most recent 500 -- see the fetchAllLancamentos comment in
 * src/app/(dashboard)/financeiro/page.tsx). Chunk the id list so the
 * ceiling moves out of reach as volume grows, instead of resurfacing as a
 * fresh outage per table.
 *
 * Stops and returns the first chunk's error (with whatever rows were
 * already collected) rather than swallowing it, so callers keep their own
 * error handling (schema-missing checks, custom messages) unchanged --
 * just wrap the existing `.in("col", ids)` in `(chunk) => ....in("col",
 * chunk)` and pass the full id list here instead.
 */
export async function fetchRowsInChunks<Row, Err = { message: string; code?: string }>(
  ids: string[],
  chunkSize: number,
  fetchChunk: (chunk: string[]) => PromiseLike<{ data: Row[] | null; error: Err | null }>,
): Promise<{ rows: Row[]; error: Err | null }> {
  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const { data, error } = await fetchChunk(ids.slice(i, i + chunkSize));
    if (error) {
      return { rows, error };
    }
    if (data) rows.push(...data);
  }
  return { rows, error: null };
}
