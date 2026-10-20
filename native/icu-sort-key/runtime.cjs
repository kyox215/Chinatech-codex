/* eslint-disable @typescript-eslint/no-require-imports -- This copied Node CJS native loader runs without a bundler or TypeScript runtime. */
// Executed by the product and by the isolated production-trace probe. No source
// compiler, workspace package resolution, network or database is needed here.
const {createHash}=require('node:crypto');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
module.exports=function createNativeSortRuntime(contract){
 let native;
 const unavailable=()=>{throw new Error('后台资料暂不可用。');};
 function current(){
  if(!contract.nodeVersions.includes(process.version)||process.versions.icu!=='78.3'||process.versions.unicode!=='17.0'||new Intl.Collator().resolvedOptions().locale!=='en-US'||!['darwin','linux'].includes(process.platform)||!['arm64','x64'].includes(process.arch))unavailable();
  if(native)return native;
  try{
   const base=join(__dirname,'build',process.platform+'-'+process.arch),metadata=JSON.parse(readFileSync(base+'.json','utf8')),bytes=readFileSync(base+'.node');
   if(metadata.contract!==contract.contract||metadata.rulesHash!==contract.rulesHash||metadata.sourceSHA256!==contract.sourceSHA256||metadata.icu!==process.versions.icu||metadata.unicode!==process.versions.unicode||metadata.node!==process.version||metadata.platform!==process.platform||metadata.arch!==process.arch||metadata.addonSHA256!==createHash('sha256').update(bytes).digest('hex'))unavailable();
   const loaded=require(base+'.node');if(!loaded||typeof loaded.key!=='function')unavailable();
   const probe=loaded.key('DEMO ꟎ 10',true);
   if(!Buffer.isBuffer(probe.key)||probe.key.at(-1)!==0||probe.ucaVersion.join('.')!=='17.0.0.0'||probe.collatorVersion.join('.')!=='153.136.0.0')unavailable();
   native=loaded;return native;
  }catch{unavailable();}
 }
 return {requireRuntime:()=>{current();},key:(value,mode)=>{
  if(typeof value!=='string'||value.length>1000000||!['retail-name','default-tie'].includes(mode))unavailable();
  const result=current().key(value,mode==='retail-name');
  if(!Buffer.isBuffer(result.key)||result.key.length<1||result.key.length>4000000||result.key.at(-1)!==0||result.ucaVersion.join('.')!=='17.0.0.0'||result.collatorVersion.join('.')!=='153.136.0.0')unavailable();
  return result.key;
 }};
};
