/** Proxy/upstream documents must never escape as native parser errors or HTML.
 * Callers handle authoritative identity statuses before decoding this body.
 */
export async function readResponseObject(response:Response){
 try{
  const value=await response.json();
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();
  return value;
 }catch{
  throw Object.assign(new Error('后台资料暂不可用。'),{status:response.status});
 }
}
