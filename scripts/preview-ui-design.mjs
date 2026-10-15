import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

const testing = process.env.UI_FEEDBACK_TEST === "1";
const root = resolve(testing ? ".local/ui-feedback-test-preview" : ".local/ui-design-preview");
mkdirSync(`${root}/app/destination`, { recursive: true });
for (const folder of ["components", "lib", "node_modules", "public", "ui-design"]) if (!existsSync(`${root}/${folder}`)) symlinkSync(resolve(folder), `${root}/${folder}`, "dir");
if (testing) {
  if (!existsSync(`${root}/tests`)) symlinkSync(resolve("tests"), `${root}/tests`, "dir");
  mkdirSync(`${root}/app/feedback-test`, { recursive: true });
  writeFileSync(`${root}/app/feedback-test/page.tsx`, `import{FeedbackFixture}from'@/tests/fixtures/ui-feedback-fixture';export default function Page(){return <FeedbackFixture/>}`);
}
writeFileSync(`${root}/package.json`, JSON.stringify({ name: "chinatech-ui-design-preview", private: true }));
writeFileSync(`${root}/tsconfig.json`, JSON.stringify({ compilerOptions: { target: "ES2017", lib: ["dom", "esnext"], jsx: "react-jsx", moduleResolution: "bundler", strict: true, noEmit: true, esModuleInterop: true, resolveJsonModule: true, module: "esnext", skipLibCheck: true, paths: { "@/*": ["./*"] } }, exclude: ["node_modules"] }));
if (!existsSync(`${root}/app/globals.css`)) symlinkSync(resolve("app/globals.css"), `${root}/app/globals.css`);
writeFileSync(`${root}/app/layout.tsx`, `import './globals.css';import{LanguageProvider}from'@/components/language-provider';import{OperationFeedbackProvider}from'@/components/operation-feedback';import{ToastProvider}from'@/components/toast';export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body><LanguageProvider><ToastProvider><OperationFeedbackProvider>{children}</OperationFeedbackProvider></ToastProvider></LanguageProvider></body></html>}`);
writeFileSync(`${root}/app/page.tsx`, `import{UIDesignCatalog}from'@/ui-design/catalog';export default function Page(){return <UIDesignCatalog/>}`);
writeFileSync(`${root}/app/destination/page.tsx`, `import{UIDesignCatalog}from'@/ui-design/catalog';export const dynamic='force-dynamic';export default async function Page(){await new Promise(resolve=>setTimeout(resolve,2000));return <UIDesignCatalog destination/>}`);
async function available(port) { return new Promise(resolve => { const server = createServer(); server.once("error", () => resolve(false)); server.listen(port, "127.0.0.1", () => server.close(() => resolve(true))); }); }
let port;
for (let candidate = testing ? 3481 : 3471; candidate <= (testing ? 3489 : 3479); candidate++) if (await available(candidate)) { port = candidate; break; }
if (!port) throw new Error("UI preview ports 3471–3479 are occupied.");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", root, "--hostname", "127.0.0.1", "--port", String(port)], { stdio: "inherit", env: { ...process.env, BACKEND_MODE: "preview", LOCAL_PREVIEW: "false", APP_DATABASE_URL: "", SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", NEXT_TELEMETRY_DISABLED: "1" } });
writeFileSync(`${root}/server.json`, JSON.stringify({ port, url: `http://127.0.0.1:${port}/`, pid: child.pid, source: "ui-design/catalog.tsx", data: "DEMO only; no business Provider or API", runId: process.env.UI_FEEDBACK_RUN ?? "interactive" }, null, 2));
process.on("SIGINT", () => child.kill("SIGTERM"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", code => process.exit(code ?? 1));
