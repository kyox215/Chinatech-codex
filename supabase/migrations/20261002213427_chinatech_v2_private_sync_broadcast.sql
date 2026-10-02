-- Database Broadcast is the transactional outbox. No business data or JWT is
-- placed in messages; reconnecting clients always fetch the authorised state.
create function chinatech_v2_private.sync_topic_access(target_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select chinatech_v2_private.live_user() and exists (
    select 1 from chinatech_v2.store_memberships m
    where m.user_id = auth.uid() and m.membership_status = 'active'
      and target_topic = 'ct:store:' || m.store_id::text
  );
$$;
revoke all on function chinatech_v2_private.sync_topic_access(text) from public, anon;
grant usage on schema chinatech_v2_private to authenticated;
grant execute on function chinatech_v2_private.sync_topic_access(text) to authenticated;

-- Existing legacy permissive policies must not open our namespace. Guard only
-- ct:store topics; leave every other application's policies unchanged.
create policy ct_sync_namespace_guard on realtime.messages as restrictive
for all to anon, authenticated
using (
  topic not like 'ct:store:%' or (
    extension = 'broadcast' and topic = (select realtime.topic())
    and chinatech_v2_private.sync_topic_access(topic)
  )
)
with check (topic not like 'ct:store:%');
create policy ct_sync_receive on realtime.messages for select to authenticated
using (extension = 'broadcast' and topic = (select realtime.topic())
  and chinatech_v2_private.sync_topic_access(topic));

create function chinatech_v2_private.notify_store_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_store uuid; current_revision bigint;
begin
  if tg_table_name = 'store_state' then
    target_store := new.store_id;
    current_revision := new.revision;
    perform realtime.send(jsonb_build_object('revision', current_revision), 'changed', 'ct:store:' || target_store::text, true);
  elsif tg_table_name = 'store_memberships' then
    target_store := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
    select revision into current_revision from chinatech_v2_private.store_state where store_id = target_store;
    perform realtime.send(jsonb_build_object('revision', coalesce(current_revision, 0)), 'changed', 'ct:store:' || target_store::text, true);
    if tg_op = 'UPDATE' and old.store_id <> new.store_id then
      select revision into current_revision from chinatech_v2_private.store_state where store_id = old.store_id;
      perform realtime.send(jsonb_build_object('revision', coalesce(current_revision, 0)), 'changed', 'ct:store:' || old.store_id::text, true);
    end if;
  else
    for target_store, current_revision in
      select m.store_id, coalesce(s.revision, 0) from chinatech_v2.store_memberships m
      left join chinatech_v2_private.store_state s on s.store_id = m.store_id
      where m.user_id = new.id
    loop
      perform realtime.send(jsonb_build_object('revision', current_revision), 'changed', 'ct:store:' || target_store::text, true);
    end loop;
  end if;
  return null;
end;
$$;
revoke all on function chinatech_v2_private.notify_store_sync() from public, anon, authenticated, chinatech_runtime;
create trigger ct_store_sync after insert or update on chinatech_v2_private.store_state
for each row execute function chinatech_v2_private.notify_store_sync();
create trigger ct_membership_sync after insert or update or delete on chinatech_v2.store_memberships
for each row execute function chinatech_v2_private.notify_store_sync();
create trigger ct_account_sync after update of account_status, display_name, email on chinatech_v2.accounts
for each row when (old.account_status is distinct from new.account_status or old.display_name is distinct from new.display_name or old.email is distinct from new.email)
execute function chinatech_v2_private.notify_store_sync();
