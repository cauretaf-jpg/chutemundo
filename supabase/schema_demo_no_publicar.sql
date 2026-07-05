-- SOLO PARA PRUEBAS PRIVADAS.
-- Permite que la anon key lea y escriba el respaldo main.
-- No usar en una app pública, porque cualquiera con la anon key podría modificar el respaldo.

create policy "demo_read_main_state"
on public.chutemundo_app_states
for select
to anon
using (id = 'main');

create policy "demo_insert_main_state"
on public.chutemundo_app_states
for insert
to anon
with check (id = 'main');

create policy "demo_update_main_state"
on public.chutemundo_app_states
for update
to anon
using (id = 'main')
with check (id = 'main');
