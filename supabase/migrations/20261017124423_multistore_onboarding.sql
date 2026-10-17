-- Read only the caller's application names without widening stores RLS.
-- This narrow private definer is necessary because an applicant is not yet a
-- member. It accepts no target account/store and never returns bearer secrets.
create function chinatech_v2_private.read_own_store_applications(before_at timestamptz default null,before_id uuid default null,page_size integer default 26)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not chinatech_v2_private.live_user() then raise exception 'Invalid session' using errcode='42501'; end if;
  if page_size is null or page_size not between 1 and 26 or (before_at is null)<>(before_id is null) then raise exception 'Invalid page' using errcode='22023'; end if;
  select jsonb_build_object('applications',coalesce((
    select jsonb_agg(to_jsonb(page) order by page.created_at desc,page.id desc) from (
      select a.id,a.status,a.created_at,to_char(a.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_created_at,a.reviewed_at,s.name as "storeName",
        case when i.revoked_at is not null then 'revoked' when i.consumed_at is not null then 'consumed' when i.expires_at<=now() then 'expired' else 'active' end as "invitationStatus",
        i.expires_at as "invitationExpiresAt"
      from chinatech_v2_private.store_applications a
      join chinatech_v2.stores s on s.id=a.store_id
      join chinatech_v2_private.store_invitations i on i.id=a.invitation_id and i.store_id=a.store_id
      where a.applicant_id=auth.uid() and (before_at is null or (a.created_at,a.id)<(before_at,before_id))
      order by a.created_at desc,a.id desc limit page_size
    ) page
  ),'[]'::jsonb),'totalCount',(select count(*) from chinatech_v2_private.store_applications a where a.applicant_id=auth.uid())) into result;
  return result;
end $$;
revoke all on function chinatech_v2_private.read_own_store_applications(timestamptz,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function chinatech_v2_private.read_own_store_applications(timestamptz,uuid,integer) to chinatech_runtime;

create index store_applications_applicant_page on chinatech_v2_private.store_applications(applicant_id,created_at desc,id desc);
create index store_applications_store_status_page on chinatech_v2_private.store_applications(store_id,status,created_at desc,id desc);
create index store_invitations_store_page on chinatech_v2_private.store_invitations(store_id,created_at desc,id desc);

-- Preserve admission/one-person consumption and add accurate own application
-- status to a read-only invitation check. Expiry/revocation still fail closed.
create or replace function chinatech_v2_private.invitation_action(token_digest text, apply_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation record; existing record; actor uuid:=auth.uid();
begin
  if not chinatech_v2_private.live_user() or token_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid session' using errcode='42501'; end if;
  select i.*,s.name into invitation from chinatech_v2_private.store_invitations i join chinatech_v2.stores s on s.id=i.store_id where i.token_hash=token_digest for update of i;
  if not found or invitation.revoked_at is not null or invitation.expires_at<=now() or (invitation.applicant_id is not null and invitation.applicant_id<>actor) then raise exception 'Invitation unavailable' using errcode='P0001'; end if;
  select * into existing from chinatech_v2_private.store_applications where invitation_id=invitation.id;
  if apply_request is not null then
    if exists(select 1 from chinatech_v2.store_memberships where store_id=invitation.store_id and user_id=actor and membership_status='active') then raise exception 'Already a member' using errcode='P0001'; end if;
    if existing.id is not null then
      if existing.applicant_id<>actor or existing.id<>apply_request then raise exception 'Request conflict' using errcode='22023'; end if;
      return jsonb_build_object('id',existing.id,'storeName',invitation.name,'status',existing.status,'expiresAt',invitation.expires_at);
    end if;
    update chinatech_v2_private.store_invitations set applicant_id=actor,consumed_at=now() where id=invitation.id;
    insert into chinatech_v2_private.store_applications(id,store_id,invitation_id,applicant_id) values(apply_request,invitation.store_id,invitation.id,actor);
    return jsonb_build_object('id',apply_request,'storeName',invitation.name,'status','pending','expiresAt',invitation.expires_at);
  end if;
  return jsonb_build_object('storeName',invitation.name,'expiresAt',invitation.expires_at,'applied',invitation.applicant_id=actor,'status',case when existing.applicant_id=actor then existing.status else null end);
end $$;
revoke all on function chinatech_v2_private.invitation_action(text,uuid) from public,anon,authenticated,service_role;
grant execute on function chinatech_v2_private.invitation_action(text,uuid) to chinatech_runtime;
