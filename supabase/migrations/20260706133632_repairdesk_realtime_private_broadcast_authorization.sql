-- RepairDesk Realtime private Broadcast authorization.
--
-- This migration is a local approval draft only until the Owner explicitly
-- approves applying it to the target Supabase project.
--
-- Required dashboard setting before enabling app flags:
-- Realtime Settings -> disable "Allow public access" so private channels are
-- enforced by realtime.messages RLS.

alter table realtime.messages enable row level security;

revoke all on table realtime.messages from anon;
revoke insert, update, delete on table realtime.messages from public;
revoke insert, update, delete on table realtime.messages from authenticated;
grant select on table realtime.messages to authenticated;

drop policy if exists repairdesk_realtime_store_broadcast_receive
  on realtime.messages;

create policy repairdesk_realtime_store_broadcast_receive
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) ~* '^repairdesk:v1:store:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:(orders|customers|inventory|settings)$'
  and exists (
    select 1
    from public.store_memberships sm
    join public.stores s on s.id = sm.store_id
    where sm.user_id = (select auth.uid())
      and sm.status = 'active'
      and s.status = 'active'
      and sm.store_id = substring(
        (select realtime.topic())
        from '^repairdesk:v1:store:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}):[a-z]+$'
      )::uuid
  )
);

-- Intentionally no INSERT policy for anon/authenticated clients.
-- Business Broadcast messages are sent by the server-side service role only.
