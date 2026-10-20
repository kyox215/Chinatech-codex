/** Keep bounded input on the wire. Case folding/NFKC can expand UTF-16 length;
 * derived needles never re-enter the raw validator or truncate real queries. */
export function listSearchInput(value:unknown):string {
 if(typeof value!=="string"||value.length>160)throw new Error("请求资料无效。");
 return value.trim();
}
export function listSearchNeedle(value:string,compatibility=false) {
 return (compatibility?value.normalize("NFKC"):value).toLocaleLowerCase();
}
