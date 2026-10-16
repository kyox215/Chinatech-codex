import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Verify the files emitted by Next, rather than the developer's node_modules.
// Node's permission boundary prevents a missing dependency from falling back to
// the workspace or a globally installed browser driver.
const root = process.cwd();
const dist = resolve(root, process.argv[2] ?? '.next');
const traceFile = join(dist, 'server/app/api/backend/repair-receipt/route.js.nft.json');
const trace = JSON.parse(readFileSync(traceFile, 'utf8'));
const directory = resolve(root, process.argv[3] ?? '.company-tmp/performance-20261017/receipt-trace');
assert.ok(directory.startsWith(root + sep), 'Evidence must stay in this project');
mkdirSync(directory, { recursive: true });
const sandbox = mkdtempSync(join(directory, 'runtime-'));
const copied = [];
for (const entry of trace.files) {
  const source = resolve(dirname(traceFile), entry);
  // Turbopack may also emit a directory alias for an external package; the
  // traced individual files below are the deployable runtime, not that symlink.
  if (!statSync(source).isFile()) continue;
  const marker = '/node_modules/';
  const at = source.indexOf(marker);
  if (at >= 0) {
    const tail = source.slice(at + marker.length);
    const target = join(sandbox, 'node_modules', tail);
    assert.ok(target.startsWith(sandbox + sep));
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { dereference: true });
    copied.push({ file: tail, sha256: createHash('sha256').update(readFileSync(source)).digest('hex') });
  }
}
for (const file of ['browsers.json', 'package.json', 'index.js', 'lib/coreBundle.js']) assert.ok(existsSync(join(sandbox, 'node_modules/playwright-core', file)), `Production trace omitted playwright-core/${file}`);
const probe = join(sandbox, 'probe.cjs');
writeFileSync(probe, `const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
assert.equal(chromium.name(),'chromium');
const browsers=require('playwright-core/browsers.json');
assert.ok(browsers.browsers.some(b=>b.name==='chromium'));
console.log(JSON.stringify({chromium:chromium.name(),browserMetadata:true}));\n`);
// browsers.json is private to the package's exports: load exactly the same file
// as coreBundle does, without adding a public export to third-party packages.
writeFileSync(probe, readFileSync(probe, 'utf8').replace("require('playwright-core/browsers.json')", "require(require('node:path').join(require('node:path').dirname(require.resolve('playwright-core/package.json')),'browsers.json'))"));
const run = spawnSync(process.execPath, ['--permission', '--allow-fs-read=' + sandbox, probe], { cwd: sandbox, env: { PATH: process.env.PATH ?? '', NODE_ENV: 'production' }, encoding: 'utf8', timeout: 15000 });
const result = { trace: relative(root, traceFile), sandbox: relative(root, sandbox), isolated: true, node: process.version, status: run.status, output: run.stdout.trim(), error: run.stderr.trim(), files: copied };
writeFileSync(join(directory, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
assert.equal(run.status, 0, run.stderr || run.stdout);
assert.ok(!isAbsolute(result.trace));
assert.equal(realpathSync(sandbox), sandbox);
if (process.argv.includes('--render')) {
  const renderProbe = join(sandbox, 'render.cjs');
  writeFileSync(renderProbe, `const assert=require('node:assert/strict');
const path=require('node:path');const fs=require('node:fs');
const Module=require('node:module');const resolve=Module._resolveFilename;
Module._resolveFilename=function(...args){const filename=resolve.apply(this,args);if(!Module.isBuiltin(filename))assert.ok(filename.startsWith(__dirname+path.sep),'Dependency escaped copied production runtime: '+filename);return filename;};
assert.ok(require.resolve('playwright-core').startsWith(__dirname+path.sep));
(async()=>{const {chromium}=require('playwright-core');let options={headless:true};
if(process.platform==='linux'){const namespace=require('@sparticuz/chromium');const bundled=namespace.default??namespace;options={...options,args:bundled.args,executablePath:await bundled.executablePath()};}
const browser=await chromium.launch(options);
try {const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'});await context.route('**/*',route=>route.abort());const page=await context.newPage();await page.setContent('<!doctype html><title>ChinaTech packaged receipt runtime DEMO</title><p>DEMO: isolated packaged Chromium PDF smoke check</p>');const bytes=await page.pdf({format:'A4'});assert.equal(bytes.subarray(0,5).toString(),'%PDF-');fs.writeFileSync(path.join(__dirname,'packaged-runtime-demo.pdf'),bytes);console.log(JSON.stringify({pdf:true,bytes:bytes.length,driver:require.resolve('playwright-core')}));}
finally {await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});\n`);
  const rendered = spawnSync(process.execPath, [renderProbe], { cwd: sandbox, env: { ...process.env, NODE_PATH: '', NODE_ENV: 'production' }, encoding: 'utf8', timeout: 45000 });
  result.render = { status: rendered.status, output: rendered.stdout.trim(), error: rendered.stderr.trim() };
  writeFileSync(join(directory, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
  assert.equal(rendered.status, 0, rendered.stderr || rendered.stdout);
}
console.log(JSON.stringify({ status: 'passed', isolated: true, files: copied.length, evidence: relative(root, join(directory, 'verification.json')) }));
