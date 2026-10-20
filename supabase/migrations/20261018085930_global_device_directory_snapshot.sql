-- Public reference data only. Existing catalog management/session/RLS rules stay intact.
create table chinatech_v2_private.device_directory_versions (
 version text primary key check(version ~ '^[a-f0-9]{64}$'),
 catalog_revision bigint not null unique,
 manifest_body text not null check(jsonb_typeof(manifest_body::jsonb)='object' and manifest_body::jsonb->>'version'=version),
 created_at timestamptz not null default now()
);
create table chinatech_v2_private.device_directory_shards (
 version text not null references chinatech_v2_private.device_directory_versions(version),
 shard_key text not null check(shard_key ~ '^(phone|tablet|laptop|desktop|console|other)-[a-f0-9]{64}$'),
 body text not null check(jsonb_typeof(body::jsonb)='object'),
 sha256 text not null check(sha256=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(body,'UTF8')),'hex')),
 primary key(version,shard_key)
);
create table chinatech_v2_private.device_directory_pointer (
 singleton boolean primary key default true check(singleton),
 version text not null references chinatech_v2_private.device_directory_versions(version)
);
alter table chinatech_v2_private.device_directory_versions enable row level security;
alter table chinatech_v2_private.device_directory_versions force row level security;
alter table chinatech_v2_private.device_directory_shards enable row level security;
alter table chinatech_v2_private.device_directory_shards force row level security;
alter table chinatech_v2_private.device_directory_pointer enable row level security;
alter table chinatech_v2_private.device_directory_pointer force row level security;
revoke all on chinatech_v2_private.device_directory_versions,chinatech_v2_private.device_directory_shards,chinatech_v2_private.device_directory_pointer from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.device_directory_versions,chinatech_v2_private.device_directory_shards,chinatech_v2_private.device_directory_pointer to chinatech_runtime;
create policy public_directory_versions_read on chinatech_v2_private.device_directory_versions for select to chinatech_runtime using(true);
create policy public_directory_shards_read on chinatech_v2_private.device_directory_shards for select to chinatech_runtime using(true);
create policy public_directory_pointer_read on chinatech_v2_private.device_directory_pointer for select to chinatech_runtime using(true);

-- Only the catalog revision trigger and the schema owner may publish. No dynamic SQL,
-- client payload, business table, actor, store or Auth identity enters this projection.
create function chinatech_v2_private.publish_device_directory() returns void
language plpgsql security definer set search_path='' as $$
declare
 rev bigint;
 chunks jsonb;
 descriptors jsonb;
 base jsonb;
 manifest text;
 ver text;
 chunk jsonb;
begin
 select revision into strict rev from chinatech_v2_private.device_catalog_control where singleton for update;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'key',s.category||'-'||pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(s.brand,'UTF8')),'hex'),
   'category',s.category,'brand',s.brand,'count',s.total,'body',s.body,
   'sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(s.body,'UTF8')),'hex')) order by s.category,s.brand),'[]'::jsonb)
 into chunks from (
   select category,brand,count(*)::int as total,pg_catalog.jsonb_build_object('formatVersion',1,'category',category,'brand',brand,
     'models',pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'id',id,'category',category,'brand',brand,'family',data->'family','name',data->'name',
       'releasedAt',data->'releasedAt','year',data->'year','network',data->'network','platform',data->'platform',
       'modelCodes',data->'modelCodes','aliases',data->'aliases','status',data->'status') order by id))::text as body
   from chinatech_v2_private.device_catalog_entries where enabled group by category,brand
 ) s;
 select coalesce(pg_catalog.jsonb_agg(value-'body' order by value->>'key'),'[]'::jsonb) into descriptors from pg_catalog.jsonb_array_elements(chunks);
 base:=pg_catalog.jsonb_build_object('formatVersion',1,'revision',rev::text,'shards',descriptors);
 ver:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(base::text,'UTF8')),'hex');
 manifest:=(base||pg_catalog.jsonb_build_object('version',ver))::text;
 insert into chinatech_v2_private.device_directory_versions(version,catalog_revision,manifest_body) values(ver,rev,manifest) on conflict(version) do nothing;
 if not exists(select 1 from chinatech_v2_private.device_directory_versions where version=ver and manifest_body=manifest and catalog_revision=rev) then raise exception 'Directory version collision'; end if;
 for chunk in select value from pg_catalog.jsonb_array_elements(chunks) loop
   insert into chinatech_v2_private.device_directory_shards(version,shard_key,body,sha256) values(ver,chunk->>'key',chunk->>'body',chunk->>'sha256') on conflict(version,shard_key) do nothing;
   if not exists(select 1 from chinatech_v2_private.device_directory_shards where version=ver and shard_key=chunk->>'key' and body=chunk->>'body' and sha256=chunk->>'sha256') then raise exception 'Directory shard collision'; end if;
 end loop;
 -- This is last: any failure above rolls back catalog changes and pointer together.
 insert into chinatech_v2_private.device_directory_pointer(singleton,version) values(true,ver) on conflict(singleton) do update set version=excluded.version;
end;
$$;
revoke all on function chinatech_v2_private.publish_device_directory() from public,anon,authenticated,chinatech_runtime;
create function chinatech_v2_private.device_directory_revision_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform chinatech_v2_private.publish_device_directory();
 return new;
end;
$$;
revoke all on function chinatech_v2_private.device_directory_revision_changed() from public,anon,authenticated,chinatech_runtime;
create trigger device_directory_publish after update of revision on chinatech_v2_private.device_catalog_control
for each row when(old.revision is distinct from new.revision) execute function chinatech_v2_private.device_directory_revision_changed();
select chinatech_v2_private.publish_device_directory();
