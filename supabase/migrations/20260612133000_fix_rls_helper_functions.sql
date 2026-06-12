create or replace function public.current_papel_usuario()
returns public.papel_usuario
language sql
stable
security definer
set search_path = public
as $$
  select papel
  from public.usuarios
  where id = auth.uid()
    and ativo = true;
$$;

create or replace function public.current_depositante_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select depositante_id
  from public.usuarios
  where id = auth.uid()
    and ativo = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_papel_usuario() in ('ADMIN', 'TI'), false);
$$;

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
      or (
        public.current_depositante_id() is not null
        and public.current_depositante_id() = target_depositante_id
      ),
      false
    );
$$;

grant execute on function public.current_papel_usuario() to anon, authenticated, service_role;
grant execute on function public.current_depositante_id() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.can_access_depositante(uuid) to anon, authenticated, service_role;
