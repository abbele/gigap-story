-- SUPABASE: grant espliciti per il ruolo anon e authenticated.
-- Necessari perché PostgreSQL non concede automaticamente l'accesso alle tabelle.
-- RLS è disabilitata — i permessi applicativi sono gestiti nelle API routes Next.js.
-- TODO: @fase-futura — abilitare RLS e rimuovere i grant diretti (vedi ROADMAP.md)

grant select, insert, update, delete on table stories to anon;
grant select, insert, update, delete on table stories to authenticated;
grant select, insert, update, delete on table stories to service_role;

-- PERF: permesso di eseguire la funzione RPC per il contatore visite atomico
grant execute on function increment_view_count(uuid) to anon;
grant execute on function increment_view_count(uuid) to authenticated;
grant execute on function increment_view_count(uuid) to service_role;
