#!/usr/bin/env node
// Explicit production operator entry. Does not install migrations or change app flags.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {productionProjectRef,activationFamilies,currentModelSpecs,sourceManifest,assertSourceManifest,admitProductionConnection,validateActivationContract,privateJSON,safeError,countNotice,writeJournal,loadResourceProbe,executeActivation,activationSHA} from './lib/production-activation.mjs';
const plan={planOnly:true,connections:0,mutations:0,projectRef:productionProjectRef,families:activationFamilies,maximumRows:200,statementTimeoutMs:30000,lockTimeoutMs:5000,default:'No credential file is read and no database connection is created',scope:'Operator activation only, after root-reviewed exact migrations/metadata. Canonical rows stay in process; report contains counts/hashes only.',executionRequirements:['explicit --allow-production='+productionProjectRef,'private0600 connection file and reviewed target contract, exact single store','all source/native/probe hashes; installed model/catalog fingerprint','9 authorized canonical fingerprints; store/member/account/entitlement contents not read, static non-write audit required','root-owned fresh caller-resource probe; cloud memory explicitly unmeasured','unknown stops; --inspect read-only reconciliation and explicit reviewed resume contract before another write']};
let sql,report,reportPath,interrupted=false;
async function main(){
 const args={};for(const value of process.argv.slice(2)){assert(value.startsWith('--'));const i=value.indexOf('=');const key=i<0?value.slice(2):value.slice(2,i);assert(!Object.hasOwn(args,key),'Duplicate activation option');args[key]=i<0?true:value.slice(i+1);}
 assert(Object.keys(args).every(k=>['plan','run','inspect','allow-production','contract','connection-file','report','resume-from','reconciliation'].includes(k)),'Unknown activation option');
 assert(!(args.run&&args.inspect));if(!args.run&&!args.inspect){assert(!args['connection-file'],'Default-plan must not read credentials');console.log(JSON.stringify({...plan,sourceSHA256:sourceManifest(),models:currentModelSpecs()},null,2));return;}
 assert.equal(args['allow-production'],productionProjectRef);for(const key of['contract','connection-file','report'])assert.equal(typeof args[key],'string');
 const root=process.cwd(),project=resolve(root,'../../..'),inside=value=>{const path=resolve(value);assert(path.startsWith(project+sep),'Explicit private file must stay in this project');return path;};
 const contractPath=inside(args.contract),connectionPath=inside(args['connection-file']);reportPath=inside(args.report);assert(!existsSync(reportPath),'Keep prior journals immutable; choose a new output');
 const c=validateActivationContract(privateJSON(contractPath),{inspect:Boolean(args.inspect)});assertSourceManifest(c.sourceSHA256);
 const config=privateJSON(connectionPath);assert.deepEqual(Object.keys(config),['DB_URL']);admitProductionConnection(config.DB_URL,c.target);
 // Actual product loader validates current Node/ICU/native build before any connection.
 const{sourceLoader}=await import('../tests/helpers/typescript-source.mjs');sourceLoader()('./lib/server/intl-sort-keys').requireNativeSortRuntime();
 const sample=await loadResourceProbe(c,project),postgres=(await import('postgres')).default;
 report={complete:false,phase:'admitted',projectRef:productionProjectRef,targetSHA256:activationSHA(JSON.stringify(c.target)),sourceSHA256:activationSHA(JSON.stringify(c.sourceSHA256)),contractSHA256:activationSHA(readFileSync(contractPath)),mode:args.inspect?'inspect':'activate',results:[],guards:[],cloudMemoryMeasured:false,canonicalOriginalsEmitted:false,protectedRowContentsRead:false};writeJournal(reportPath,report);
 sql=postgres(config.DB_URL,{max:1,prepare:false,onnotice:countNotice(report),ssl:{rejectUnauthorized:true},connect_timeout:10,idle_timeout:5,connection:{statement_timeout:30000,lock_timeout:5000,application_name:'ct-reviewed-production-activation'}});
 process.once('SIGTERM',()=>{interrupted=true;});process.once('SIGINT',()=>{interrupted=true;});
 let resume;if(args['resume-from']){assert(!args.inspect);assert(args.reconciliation);const path=inside(args['resume-from']),reconciliationPath=inside(args.reconciliation);resume={path,reconciliationPath,value:privateJSON(path),reconciled:privateJSON(reconciliationPath)};}else assert(!args.reconciliation);
 await executeActivation({sql,contract:c,report,path:reportPath,sample,inspect:Boolean(args.inspect),resume,shouldStop:()=>interrupted});
}
try{await main();}catch(error){if(report){report.complete=false;report.phase='stopped';report.error=safeError(error);if(report.active?.outcome==='dispatched')report.active.outcome='unknown-no-auto-replay';}else report={complete:false,phase:'admission-stopped',error:safeError(error),connectionsMayHaveStarted:false};process.exitCode=1;}
finally{if(sql){try{await sql.end({timeout:5});}catch(error){report.complete=false;report.connectionCleanupError=safeError(error);process.exitCode=1;}}if(reportPath&&report)writeJournal(reportPath,report);}
if(report)console.log(JSON.stringify({complete:report.complete,phase:report.phase,operators:report.results?.length??0,error:report.error,cloudMemoryMeasured:false}));
