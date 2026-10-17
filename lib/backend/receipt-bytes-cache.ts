/** Ephemeral PDF bytes only. Authorization and source checks belong to each
 * request, including a cache hit; this cache never stores an access decision. */
export class ReceiptBytesCache{
 private entries=new Map<string,{bytes:Uint8Array;expiresAt:number}>();private size=0;
 constructor(private readonly limits={entries:8,bytes:16*1024*1024,itemBytes:4*1024*1024,ttl:60000},private readonly now=Date.now){}
 private remove(key:string){const row=this.entries.get(key);if(row){this.size-=row.bytes.byteLength;this.entries.delete(key);}}
 private expire(){const now=this.now();for(const[key,row]of this.entries)if(row.expiresAt<=now)this.remove(key);}
 get(key:string){this.expire();const row=this.entries.get(key);if(!row)return undefined;this.entries.delete(key);this.entries.set(key,row);return new Uint8Array(row.bytes);}
 set(key:string,bytes:Uint8Array){this.expire();if(bytes.byteLength>this.limits.itemBytes||bytes.byteLength>this.limits.bytes)return false;this.remove(key);while(this.entries.size>=this.limits.entries||this.size+bytes.byteLength>this.limits.bytes){const oldest=this.entries.keys().next().value;if(oldest===undefined)break;this.remove(oldest);}this.entries.set(key,{bytes:new Uint8Array(bytes),expiresAt:this.now()+this.limits.ttl});this.size+=bytes.byteLength;return true;}
}
