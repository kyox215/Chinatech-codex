import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
// Migration7 is immutable. The additive query contract owns current labels.
assert(process.argv.slice(2).every(value=>value==='--check'),'Only --check is supported; generate a new additive projection contract');
const result=spawnSync(process.execPath,['scripts/generate-unicode-query-contract.mjs','--check'],{encoding:'utf8'});
if(result.stdout)process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
if(result.error)throw result.error;
process.exitCode=result.status??1;
