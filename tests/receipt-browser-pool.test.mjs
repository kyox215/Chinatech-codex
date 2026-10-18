import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { sourceLoader } from './helpers/typescript-source.mjs';
const { ReceiptBrowserPool } = sourceLoader()('./lib/backend/receipt-browser-pool');
class Browser extends EventEmitter {
  connected = true; closed = 0;
  isConnected() { return this.connected; }
  async close() { this.closed++; this.disconnect(); }
  disconnect() { this.connected = false; this.emit('disconnected'); }
}
test('two concurrent leases share startup, reject a third, and release idempotently without sharing render contexts', async () => {
  let start; let launches = 0;
  const browser = new Browser(), pool = new ReceiptBrowserPool(() => { launches++; return new Promise(resolve => { start = resolve; }); });
  const first = pool.acquire(), second = pool.acquire();
  await assert.rejects(pool.acquire(), /receiptBusy/); assert.equal(launches, 1);
  start(browser); const [a, b] = await Promise.all([first, second]);
  assert.equal(a.browser, browser); assert.equal(b.browser, browser);
  a.release(); a.release(); const c = await pool.acquire();
  assert.equal(c.browser, browser); assert.equal(c.reused, true);
  await assert.rejects(pool.acquire(), /receiptBusy/); b.release(); c.release();
  await browser.close();
});
test('a failed shared launch releases both slots and does not poison the next request', async () => {
  let launches = 0; const browser = new Browser();
  const pool = new ReceiptBrowserPool(async () => { if (++launches === 1) throw new Error('DEMO launch failure'); return browser; });
  const failed = await Promise.allSettled([pool.acquire(), pool.acquire()]);
  assert(failed.every(value => value.status === 'rejected'));
  const a = await pool.acquire(), b = await pool.acquire();
  assert.equal(launches, 2); a.release(); b.release(); await browser.close();
});
test('disconnection retires only the matching process; releasing an old lease last still schedules the new idle deadline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const browsers = []; const pool = new ReceiptBrowserPool(async () => { const browser = new Browser(); browsers.push(browser); return browser; });
  const a = await pool.acquire(); a.browser.disconnect();
  const b = await pool.acquire(); assert.notEqual(b.browser, a.browser); assert.equal(b.reused, false);
  b.release(); a.browser.emit('disconnected'); const c = await pool.acquire(); assert.equal(c.browser, b.browser);
  c.release(); t.mock.timers.tick(30_000); assert.equal(b.browser.closed, 0);
  a.release(); t.mock.timers.tick(29_999); assert.equal(b.browser.closed, 0);
  t.mock.timers.tick(1); assert.equal(b.browser.closed, 1); assert.equal(browsers.length, 2);
});
test('idle retirement waits until the last lease, and reacquisition cancels the old deadline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let launches = 0; const pool = new ReceiptBrowserPool(async () => { launches++; return new Browser(); });
  const a = await pool.acquire(), b = await pool.acquire(); a.release();
  t.mock.timers.tick(30_000); assert.equal(a.browser.closed, 0);
  b.release(); t.mock.timers.tick(29_999);
  const c = await pool.acquire(); t.mock.timers.tick(30_000); assert.equal(c.browser.closed, 0);
  c.release(); t.mock.timers.tick(30_000); assert.equal(c.browser.closed, 1);
  const d = await pool.acquire(); assert.equal(launches, 2); d.release(); t.mock.timers.tick(30_000);
});
test('phase diagnostics emit only fixed names and finite nonnegative numeric values when explicitly enabled', () => {
  const { receiptMetric } = sourceLoader()('./lib/backend/receipt-phase');
  const old = process.env.RECEIPT_PHASE_METRICS, original = console.info, records = [];
  console.info = (...args) => records.push(args);
  try {
    delete process.env.RECEIPT_PHASE_METRICS; receiptMetric('cache_hit', 1); assert.equal(records.length, 0);
    process.env.RECEIPT_PHASE_METRICS = '1';
    for (const value of [-1, NaN, Infinity]) receiptMetric('pdf_ms', value);
    receiptMetric('DEMO private source', 5); receiptMetric('browser_reused', 1); receiptMetric('pdf_ms', 1.23456);
    assert.deepEqual(records, [['ct_receipt_phase', '{"phase":"browser_reused","value":1}'], ['ct_receipt_phase', '{"phase":"pdf_ms","value":1.235}']]);
  } finally { console.info = original; if (old === undefined) delete process.env.RECEIPT_PHASE_METRICS; else process.env.RECEIPT_PHASE_METRICS = old; }
});
