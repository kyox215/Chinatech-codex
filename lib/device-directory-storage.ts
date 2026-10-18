import { parseDirectoryManifest, type DirectoryPackage } from './device-directory';
export function createDeviceDirectoryStorage(factory:()=>IDBFactory|undefined=()=>typeof indexedDB==='undefined'?undefined:indexedDB,timeoutMs=1000) {
  function transaction(write: DirectoryPackage | null): Promise<DirectoryPackage | null> {
    return new Promise(resolve=>{
      const storage=factory(); if(!storage){resolve(null);return;}
      let done=false; let database:IDBDatabase|undefined; let transaction:IDBTransaction|undefined;
      const finish=(value:DirectoryPackage|null,abort=false)=>{
        if(done)return; done=true; clearTimeout(timer);
        if(abort)try{transaction?.abort();}catch{/* Already completed. */}
        database?.close(); resolve(value);
      };
      const timer=setTimeout(()=>finish(null,true),timeoutMs);
      let request:IDBOpenDBRequest;
      try{request=storage.open('chinatech-public-device-directory-v1',1);}catch{finish(null);return;}
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('snapshots'))request.result.createObjectStore('snapshots');};
      request.onerror=()=>finish(null,true); request.onblocked=()=>finish(null,true);
      request.onsuccess=()=>{
        database=request.result; if(done){database.close();return;}
        database.onversionchange=()=>finish(null,true);
        try{
          transaction=database.transaction('snapshots',write?'readwrite':'readonly');
          const store=transaction.objectStore('snapshots'); let result:DirectoryPackage|null=null;
          const operation=store.get('active');
          operation.onsuccess=()=>{
            result=operation.result??null;
            if(!write)return;
            // This read and conditional put share one readwrite transaction, so
            // another tab cannot interleave an older save after a newer version.
            if(result)try{
              const existing=result;
              const prior=parseDirectoryManifest(existing.manifest),next=parseDirectoryManifest(write.manifest);
              if(BigInt(prior.revision)>BigInt(next.revision) || (prior.revision===next.revision && (prior.version!==next.version || existing.checkedAt>write.checkedAt)))return;
            }catch{/* A valid complete package may replace corrupt storage. */}
            store.put(write,'active');
          };
          transaction.oncomplete=()=>finish(result); transaction.onerror=()=>finish(null,true); transaction.onabort=()=>finish(null);
        }catch{finish(null,true);}
      };
    });
  }
  // A timed-out transaction is aborted before the next complete package is written.
  let tail:Promise<unknown>=Promise.resolve();
  return {load:()=>transaction(null),save:(value:DirectoryPackage)=>{
    const write=tail.then(()=>transaction(value)); tail=write.catch(()=>null); return write.then(()=>{});
  }};
}
export const deviceDirectoryStorage=createDeviceDirectoryStorage();
