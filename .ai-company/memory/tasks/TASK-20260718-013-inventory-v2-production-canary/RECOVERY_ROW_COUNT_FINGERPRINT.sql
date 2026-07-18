begin;

create temporary table recovery_row_counts (
  schema_name text not null,
  table_name text not null,
  row_count bigint not null
) on commit drop;

do $$
declare
  table_row record;
begin
  for table_row in
    select schemaname, tablename
      from pg_tables
     where schemaname in ('public', 'auth', 'storage')
     order by schemaname, tablename
  loop
    execute format(
      'insert into recovery_row_counts values (%L, %L, (select count(*) from %I.%I))',
      table_row.schemaname,
      table_row.tablename,
      table_row.schemaname,
      table_row.tablename
    );
  end loop;
end;
$$;

select
  (select count(*) from recovery_row_counts) as table_count,
  (select sum(row_count) from recovery_row_counts) as total_rows,
  (
    select md5(
      string_agg(
        schema_name || '.' || table_name || ':' || row_count::text,
        '|'
        order by schema_name, table_name
      )
    )
    from recovery_row_counts
  ) as row_count_fingerprint,
  (
    select jsonb_object_agg(schema_name, schema_summary order by schema_name)
    from (
      select
        schema_name,
        jsonb_build_object(
          'tables', count(*),
          'rows', sum(row_count),
          'fingerprint', md5(
            string_agg(table_name || ':' || row_count::text, '|' order by table_name)
          )
        ) as schema_summary
      from recovery_row_counts
      group by schema_name
    ) summaries
  ) as schema_summary;

rollback;
