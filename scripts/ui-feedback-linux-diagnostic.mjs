import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = join(root, 'app/globals.css');
const originalCss = await readFile(cssPath, 'utf8');
const output = join(root, '.local/ui-feedback-linux-diagnostic');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const selector = '.button:active:not(:disabled):not([aria-disabled="true"])';
const variants = [
  { id: 'both-current', css: '' },
  { id: 'neither-static-fill', css: `${selector}{transform:none;filter:none;}\n.button--primary:active:not(:disabled):not([aria-disabled="true"]){background:var(--primary-700);}\n.button--secondary:active:not(:disabled):not([aria-disabled="true"]){background:var(--surface-subtle);}` },
  { id: 'transform-only', css: `${selector}{transform:translateY(1px);filter:none;}` },
  { id: 'filter-only', css: `${selector}{transform:none;filter:brightness(.94);}` },
  { id: 'settings-anchor-none', css: '.settings-content{overflow-anchor:none;}' },
  { id: 'root-anchor-none', css: 'html{overflow-anchor:none;}' },
];
const summary = { diagnosticOnly: true, node: process.version, platform: process.platform, sourceCssSha256: sha256(originalCss), sourceTestSha256: sha256(await readFile(join(root, 'tests/browser/settings-feedback.spec.ts'))), variants: [] };
await mkdir(output, { recursive: true });
try {
  for (const variant of variants) {
    const directory = join(output, variant.id);
    await mkdir(directory, { recursive: true });
    const css = originalCss + (variant.css ? `\n/* Temporary runner-only diagnostic variant: ${variant.id} */\n${variant.css}\n` : '');
    await writeFile(cssPath, css);
    const config = join(directory, 'playwright.config.mjs');
    await writeFile(config, `import {defineConfig,devices} from '@playwright/test';\nexport default defineConfig({
      testDir:${JSON.stringify(join(root, 'tests/browser'))},testMatch:'settings-feedback.spec.ts',fullyParallel:false,forbidOnly:true,retries:0,workers:1,
      outputDir:${JSON.stringify(join(directory, 'test-results'))},
      reporter:[['line'],['json',{outputFile:${JSON.stringify(join(directory, 'results.json'))}}]],
      use:{baseURL:'http://127.0.0.1:3121',trace:'on',screenshot:'only-on-failure'},
      projects:[{name:'chromium-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'webkit-touch',use:{...devices['iPhone 13'],viewport:{width:375,height:812}}}],
      webServer:{command:'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3121',cwd:${JSON.stringify(root)},url:'http://127.0.0.1:3121/login',reuseExistingServer:false,env:{BACKEND_MODE:'preview',LOCAL_PREVIEW:'true',NEXT_TELEMETRY_DISABLED:'1',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',APP_DATABASE_URL:''}}
    });\n`);
    const began = Date.now();
    const result = spawnSync(process.execPath, [join(root, 'node_modules/@playwright/test/cli.js'), 'test', 'settings-feedback.spec.ts', '--config', config], { cwd: root, env: { ...process.env, CI: 'true' }, encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024 });
    const log = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
    await writeFile(join(directory, 'controls.log'), log);
    const diagnostics = [];
    for (const line of log.split('\n')) {
      const marker = line.indexOf('FINANCE_RETRY_DIAGNOSTICS ');
      if (marker >= 0) try { diagnostics.push(JSON.parse(line.slice(marker + 'FINANCE_RETRY_DIAGNOSTICS '.length))); } catch { /* Raw log remains available. */ }
    }
    await writeFile(join(directory, 'finance-diagnostics.json'), JSON.stringify(diagnostics, null, 2) + '\n');
    let stats = null;
    try { stats = JSON.parse(await readFile(join(directory, 'results.json'), 'utf8')).stats; } catch { /* Harness failures are separate from assertion failures. */ }
    const record = { id: variant.id, cssSha256: sha256(css), exitCode: result.status, signal: result.signal, spawnError: result.error?.message, durationMs: Date.now() - began, stats, diagnosticCount: diagnostics.length, outcome: result.status === 0 ? 'tests_passed' : stats ? 'tests_failed' : 'harness_failed' };
    summary.variants.push(record);
    await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log('DIAGNOSTIC_VARIANT ' + JSON.stringify(record));
  }
} finally {
  await writeFile(cssPath, originalCss);
  summary.sourceCssRestored = sha256(await readFile(cssPath, 'utf8')) === summary.sourceCssSha256;
  await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
}
console.log('DIAGNOSTIC_ONLY ' + JSON.stringify(summary));
if (!summary.sourceCssRestored || summary.variants.length !== variants.length || summary.variants.some(variant => variant.outcome === 'harness_failed')) process.exitCode = 1;
