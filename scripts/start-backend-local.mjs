import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createServer } from "node:net";

if(Number(process.versions.node.split(".")[0])<22) throw new Error("正式后台需要 Node.js 22 或更新版本。");
const env=JSON.parse(readFileSync(resolve(".local/backend/env.private.json"),"utf8"));
const api=new URL(env.SUPABASE_URL);const database=new URL(env.APP_DATABASE_URL);
if(api.hostname!=="127.0.0.1" || api.port!=="55421" || database.hostname!=="127.0.0.1" || database.port!=="55422" || database.username!=="chinatech_runtime") throw new Error("本地启动只接受此项目的独立本地后台。");
const probe=createServer();
await new Promise((resolve,reject)=>{probe.once("error",reason=>reject(new Error(reason.code==="EADDRINUSE" ? "3117 端口已被占用，请保留原服务并选择其他端口。" : "无法监听本地 3117 端口，请核对本地执行权限。")));probe.listen(3117,"127.0.0.1",()=>probe.close(resolve));});
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port","3117"],{stdio:"inherit",env:{...process.env,...env}});
child.on("exit",code=>{process.exitCode=code??1;});
process.once("SIGINT",()=>child.kill("SIGINT"));process.once("SIGTERM",()=>child.kill("SIGTERM"));
