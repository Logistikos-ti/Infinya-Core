drop policy if exists "Apenas admins podem inserir transportadoras" on public.transportadoras;
drop policy if exists "Apenas admins podem atualizar transportadoras" on public.transportadoras;
drop policy if exists "Apenas admins podem deletar transportadoras" on public.transportadoras;

create policy "Apenas admins podem inserir transportadoras"
  on public.transportadoras for insert
  to authenticated
  with check (public.is_admin());

create policy "Apenas admins podem atualizar transportadoras"
  on public.transportadoras for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Apenas admins podem deletar transportadoras"
  on public.transportadoras for delete
  to authenticated
  using (public.is_admin());
