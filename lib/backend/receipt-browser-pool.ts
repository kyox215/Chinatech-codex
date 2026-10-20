import type { Browser } from "playwright-core";

// Internal transport failures are mapped to the existing localized receipt error by the route.
function browserFailure(code: "receiptBusy" | "receiptUnavailable") { return new Error(code); }

/** Browser processes may be reused; contexts and page data never are. */
export class ReceiptBrowserPool {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private idle: ReturnType<typeof setTimeout> | undefined;
  private leases = 0;
  constructor(private launch: () => Promise<Browser>, private idleMs = 30_000) {}

  async acquire() {
    if (this.leases >= 2) throw browserFailure("receiptBusy");
    this.leases++;
    clearTimeout(this.idle);
    const reused = Boolean(this.browser?.isConnected());
    try {
      if (!this.browser?.isConnected()) {
        if (!this.launching) {
          const flight = this.launch().then(browser => {
            if (!browser.isConnected()) throw browserFailure("receiptUnavailable");
            this.browser = browser;
            browser.once("disconnected", () => {
              if (this.browser === browser) this.browser = null;
            });
            return browser;
          });
          this.launching = flight;
          // Both success and failure release the startup flight without an
          // unhandled rejected finally promise or a permanently poisoned slot.
          void flight.then(() => { if (this.launching === flight) this.launching = null; }, () => { if (this.launching === flight) this.launching = null; });
        }
        await this.launching;
      }
      const browser = this.browser;
      if (!browser?.isConnected()) throw browserFailure("receiptUnavailable");
      let released = false;
      return { browser, reused, release: () => {
        if (released) return;
        released = true;
        this.release();
      } };
    } catch (error) {
      this.release();
      throw error;
    }
  }

  private release() {
    this.leases--;
    const browser = this.browser;
    if (this.leases || !browser) return;
    this.idle = setTimeout(() => {
      if (this.leases || this.browser !== browser) return;
      this.browser = null;
      void browser.close().catch(() => undefined);
    }, this.idleMs);
    this.idle.unref?.();
  }
}
