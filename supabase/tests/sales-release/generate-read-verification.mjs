// Local synthetic verification only. All SQL is derived from this checkout's current expand.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--out-dir") {
  throw new Error("Usage: node generate-read-verification.mjs --out-dir <local-output-directory>");
}
const output = resolve(args[1]);
const migration = resolve(
  root,
  "supabase/migrations/20260907132641_inventory_sales_release_expand.sql",
);
const source = readFileSync(migration, "utf8");
const functions = [
  ...source.matchAll(
    /create function ((?:private\.inventory_sales_|public\.repairdesk_inventory_sales_)[\s\S]*?\$\$;\nrevoke all on function [^;]+;)/g,
  ),
].map((match) => match[1]);
if (functions.length !== 10)
  throw new Error(`Expected 10 candidate functions; found ${functions.length}`);
const helper = functions.find((item) => item.startsWith("private.inventory_sales_missing_checks("));
if (!helper || !helper.includes("begin\n"))
  throw new Error("Candidate readiness helper is missing its barrier insertion point");
const stableRead = functions.find((item) =>
  item.startsWith("public.repairdesk_inventory_sales_read("),
);
if (!stableRead?.includes("language plpgsql stable security definer"))
  throw new Error("Candidate read must remain STABLE");
const rows = functions.map((item) => {
  const body = item.split("$$", 2)[1];
  const signature = item.match(/revoke all on function (.+?) from /)?.[1];
  if (!signature || body.includes("$source$"))
    throw new Error("Unsafe or missing function source delimiter");
  return `('${signature}',$source$${body}$source$)`;
});
const restore = `-- LOCAL synthetic instrumentation restore only; generated from current migration.\ncreate or replace function ${helper}\nalter function public.repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text) stable;\n`;
const instrument = `-- LOCAL synthetic barrier only; generated from current migration and restored by runner trap.\ncreate or replace function ${helper.replace("begin\n", "begin\n  if current_setting('application_name',true)='sales_read_probe_reader' then perform pg_advisory_xact_lock(71420260907); end if;\n")}`;
const parity = `-- LOCAL verification only; generated from current migration, never production deployment SQL.
\\set ON_ERROR_STOP on
begin;
create temporary table expected_sales_source(signature text,body text);
insert into expected_sales_source values
${rows.join(",\n")};
do $$ begin
 if exists(select 1 from expected_sales_source e left join pg_proc p on p.oid=to_regprocedure(e.signature) where p.oid is null or p.prosrc<>e.body) then raise exception 'New sales source mismatch'; end if;
 if exists(select 1 from synthetic_protected_bodies s where pg_get_functiondef(to_regprocedure(s.signature))<>s.body) then raise exception 'Original sale/gate differs'; end if;
 if exists(select 1 from pg_proc where oid in ('repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text)'::regprocedure,'repairdesk_inventory_sales_list(uuid,uuid,jsonb)'::regprocedure) and provolatile<>'s') then raise exception 'Read volatility mismatch'; end if;
 if not exists(select 1 from pg_constraint where conname='inventory_sales_delivered_timestamp_required' and convalidated) then raise exception 'Delivered CHECK missing'; end if;
 if has_function_privilege('authenticated','repairdesk_inventory_sales_list(uuid,uuid,jsonb)','execute') or not has_function_privilege('service_role','repairdesk_inventory_sales_list(uuid,uuid,jsonb)','execute') then raise exception 'List ACL mismatch'; end if;
end $$;
select count(*) as matching_new_function_bodies from expected_sales_source;
rollback;
`;
mkdirSync(output, { recursive: true });
for (const [name, text] of Object.entries({
  "pg17-read-race-restore.sql": restore,
  "pg17-read-race-instrument.sql": instrument,
  "pg17-source-parity.sql": parity,
}))
  writeFileSync(resolve(output, name), text);
process.stdout.write(
  "Generated 3 local verification inputs from 10 current candidate function bodies.\n",
);
