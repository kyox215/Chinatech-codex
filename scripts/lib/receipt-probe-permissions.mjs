import{resolve}from'node:path';
/** Read-only OS probes used during Playwright's Linux/WSL detection. Dependency
 * resolution stays limited to the copied production trace directory. */
export function receiptProbePermissions(directory,platform=process.platform){
 const probes=platform==='linux'?['/proc/version','/proc/sys/fs/binfmt_misc/WSLInterop','/run/WSL']:[];
 return['--permission','--allow-fs-read='+resolve(directory),...probes.map(path=>'--allow-fs-read='+path)];
}
