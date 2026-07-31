alter type public.papel_usuario add value if not exists 'TI';
commit;
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_papel_usuario() in ('ADMIN', 'TI'), false);
$$;
