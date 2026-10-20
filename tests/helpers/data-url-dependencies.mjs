import{createRequire}from'node:module';
import{pathToFileURL}from'node:url';
const require=createRequire(import.meta.url);
// data: modules have no package-resolution base. Preserve the actual installed
// framework implementation instead of substituting its synchronous flush.
export function resolveDataUrlPackages(source){
 return source.replace(/from\s*(['"])(react-dom)\1/g,(_match,_quote,name)=>'from '+JSON.stringify(pathToFileURL(require.resolve(name)).href));
}
