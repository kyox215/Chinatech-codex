import { afterEach } from "vitest";

const restorations: Array<() => void> = [];

/** Give touch-focused component tests an explicit tablet identity, independent of layout. */
export function mockTouchKeyboardDevice() {
  for (const [key, value] of Object.entries({
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1",
    platform: "iPad",
    maxTouchPoints: 5,
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, key);
    Object.defineProperty(navigator, key, { configurable: true, value });
    restorations.push(() => {
      if (descriptor) Object.defineProperty(navigator, key, descriptor);
      else Reflect.deleteProperty(navigator, key);
    });
  }
}

afterEach(() => {
  restorations
    .splice(0)
    .reverse()
    .forEach((restore) => restore());
});
