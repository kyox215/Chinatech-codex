// Existing store tests stub React rendering, while retaining the actual preview
// readers, staff validation and backend-mode selection behind the new hooks.
export function adaptPreviewHookImports(code, { compile, library, dataUrl, ssr = false }) {
  const hooks = new Map();
  function component(name) {
    if (hooks.has(name)) return hooks.get(name);
    let source = compile(`components/${name}${name === "staff/use-staff" ? ".ts" : ".tsx"}`);
    source = source.replace(/import \{[^}]+\} from "react";/g, `const createContext = () => ({Provider: "provider"}); const useContext = () => null; const useMemo = fn => fn(); const useSyncExternalStore = (_subscribe, read, server) => ${ssr ? "server()" : "read()"};`);
    source = source.replace(/from "@\/components\/(backend-snapshot|staff\/use-staff)"/g, (_, dependency) => `from "${component(dependency)}"`);
    source = source.replace(/from "@\/lib\/([^"]+)"/g, (_, dependency) => `from "${library(dependency)}"`);
    const url = dataUrl(source); hooks.set(name, url); return url;
  }
  return code.replace(/from "@\/components\/(backend-snapshot|staff\/use-staff)"/g, (_, name) => `from "${component(name)}"`);
}
