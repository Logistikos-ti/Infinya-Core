-- can_access_depositante() gates RLS on the operational tables (receiving,
-- shipping, cycle counts, romaneio, product kits, ...). It currently only
-- allows ADMIN/TI (via is_admin()) or a session whose own depositante_id
-- matches the row. OPERADOR is the default role for warehouse staff and
-- has no depositante_id of its own (operators work across all
-- depositantes), so every one of these checks fails for them and
-- RLS-scoped reads (createSupabaseServerClient) silently return zero
-- rows -- even though app-level snapshots computed via the admin client
-- (which bypasses RLS) show the real counts. That mismatch is what
-- produced a "1" badge on the mobile Recebimento card with an empty list
-- underneath it once tapped.
--
-- Deliberately scoped to can_access_depositante(), not is_admin() itself,
-- so account-management tables (usuarios_*, depositantes_*) stay
-- ADMIN/TI-only.
create or replace function public.can_access_depositante(target_depositante_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      public.is_admin()
      or public.current_papel_usuario() = 'OPERADOR'
      or (
        public.current_depositante_id() is not null
        and public.current_depositante_id() = target_depositante_id
      ),
      false
    );
$$;
