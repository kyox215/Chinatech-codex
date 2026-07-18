import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const dumpPath = process.argv[2];

if (!dumpPath) {
  throw new Error("Usage: node count-copy-rows.mjs <plain-sql-copy-dump>");
}

const counts = new Map();
let activeTable = null;
let activeCount = 0;

for (const line of readFileSync(dumpPath, "utf8").split("\n")) {
  const copyHeader = line.match(/^COPY "([^"]+)"\."([^"]+)" .* FROM stdin;$/);
  if (copyHeader) {
    if (activeTable !== null) {
      throw new Error(`Unterminated COPY block before ${copyHeader[1]}.${copyHeader[2]}`);
    }
    activeTable = `${copyHeader[1]}.${copyHeader[2]}`;
    activeCount = 0;
    continue;
  }

  if (activeTable === null) continue;
  if (line === "\\.") {
    counts.set(activeTable, activeCount);
    activeTable = null;
    activeCount = 0;
    continue;
  }
  activeCount += 1;
}

if (activeTable !== null) {
  throw new Error(`Unterminated COPY block for ${activeTable}`);
}

const canonicalRows = [...counts.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([tableName, rowCount]) => `${tableName}:${rowCount}`);

if (process.argv[3] === "--compare-sql") {
  const values = [...counts.entries()]
    .map(([qualifiedName, rowCount]) => {
      const [schemaName, tableName] = qualifiedName.split(".");
      const escapedSchema = schemaName.replaceAll("'", "''");
      const escapedTable = tableName.replaceAll("'", "''");
      return `('${escapedSchema}', '${escapedTable}', ${rowCount})`;
    })
    .join(",\n");

  console.log(`begin;
create temporary table dump_row_counts (
  schema_name text not null,
  table_name text not null,
  row_count bigint not null
) on commit drop;
insert into dump_row_counts values
${values};
create temporary table restored_row_counts (like dump_row_counts) on commit drop;
do $$
declare table_row record;
begin
  for table_row in
    select schemaname, tablename
      from pg_tables
     where schemaname in ('public', 'auth', 'storage')
  loop
    execute format(
      'insert into restored_row_counts values (%L, %L, (select count(*) from %I.%I))',
      table_row.schemaname,
      table_row.tablename,
      table_row.schemaname,
      table_row.tablename
    );
  end loop;
end;
$$;
select
  coalesce(dump.schema_name, restored.schema_name) as schema_name,
  coalesce(dump.table_name, restored.table_name) as table_name,
  dump.row_count as dump_rows,
  restored.row_count as restored_rows
from dump_row_counts dump
full join restored_row_counts restored
  using (schema_name, table_name)
where dump.row_count is distinct from restored.row_count
order by schema_name, table_name;
rollback;`);
  process.exit(0);
}

const schemas = {};
for (const schemaName of ["auth", "public", "storage"]) {
  const schemaRows = canonicalRows.filter((row) => row.startsWith(`${schemaName}.`));
  schemas[schemaName] = {
    tables: schemaRows.length,
    rows: schemaRows.reduce((sum, row) => sum + Number(row.slice(row.lastIndexOf(":") + 1)), 0),
    fingerprint: createHash("md5")
      .update(schemaRows.map((row) => row.slice(schemaName.length + 1)).join("|"))
      .digest("hex"),
  };
}

console.log(
  JSON.stringify({
    table_count: canonicalRows.length,
    total_rows: [...counts.values()].reduce((sum, rowCount) => sum + rowCount, 0),
    row_count_fingerprint: createHash("md5").update(canonicalRows.join("|")).digest("hex"),
    schema_summary: schemas,
  }),
);
