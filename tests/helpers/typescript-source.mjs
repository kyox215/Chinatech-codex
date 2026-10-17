import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname,resolve } from 'node:path';
import ts from 'typescript';
export function sourceLoader(root=process.cwd(),overrides={}) {
  const native=createRequire(resolve(root,'package.json')),modules=new Map();
  function load(name,from=root) {
    if(Object.hasOwn(overrides,name))return overrides[name];
    if(name==='server-only')return {};
    if(!name.startsWith('.')&&!name.startsWith('@/'))return native(name);
    const file=resolve(name.startsWith('@/')?root:from,name.startsWith('@/')?name.slice(2):name).replace(/\.ts$/,'')+'.ts';
    if(modules.has(file))return modules.get(file).exports;
    const loaded={exports:{}};modules.set(file,loaded);
    const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    new Function('require','module','exports',code)(value=>load(value,dirname(file)),loaded,loaded.exports);
    return loaded.exports;
  }
  return load;
}
