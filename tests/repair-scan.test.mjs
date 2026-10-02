import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import zxing from "@zxing/library";
const compiled = ts.transpileModule(readFileSync(new URL("../lib/repair-scan.ts", import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { repairScanMatches, cameraErrorMessage } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const orders = [{ id: "CT-2026-0927", device: { serial: "DEMO-MBA-0927" } }, { id: "CT-2026-0929", device: { serial: "DEMO-SHARED" } }, { id: "CT-2026-0916", device: { serial: "DEMO-SHARED" } }];
const origin = "https://repair.example";
test("扫码按完整工单号或设备序列号匹配，保留全部候选", () => {
 assert.equal(repairScanMatches(" ct-2026-0927 ",orders,origin)[0].id,"CT-2026-0927");
 assert.equal(repairScanMatches("demo-mba-0927",orders,origin)[0].id,"CT-2026-0927");
 assert.equal(repairScanMatches("DEMO-SHARED",orders,origin).length,2);
 for (const value of ["", "CT-2026", "MacBook Air", "x".repeat(513)]) assert.deepEqual(repairScanMatches(value,orders,origin),[]);
});
test("只接受本站已知工单路径，不从外链或恶意文本打开页面", () => {
 assert.equal(repairScanMatches(`${origin}/app/repairs/CT-2026-0927`,orders,origin).length,1);
 assert.equal(repairScanMatches("/app/repairs/CT-2026-0927",orders,origin).length,1);
 for (const value of ["https://other.example/app/repairs/CT-2026-0927", "//other.example/app/repairs/CT-2026-0927", `${origin}/app/repairs/CT-2026-0927?next=evil`, "javascript:alert(1)", "/app/repairs/%FF", "/app/repairs/unknown"]) assert.deepEqual(repairScanMatches(value,orders,origin),[]);
});
test("权限拒绝、相机缺失与占用提供可恢复提示",()=>{
 for(const name of ["NotAllowedError","NotFoundError","NotReadableError"]){const error=new Error();error.name=name;assert.ok(cameraErrorMessage(error).length>10);}
});
test("实际解码二维码后定位工单",()=>{
 const { MultiFormatWriter, BarcodeFormat, RGBLuminanceSource, HybridBinarizer, BinaryBitmap, MultiFormatReader }=zxing;
 for(const format of [BarcodeFormat.QR_CODE]){
  const encoded=new MultiFormatWriter().encode("CT-2026-0927",format,480,240,new Map());
  const pixels=new Uint8ClampedArray(480*240);for(let y=0;y<240;y++)for(let x=0;x<480;x++)pixels[y*480+x]=encoded.get(x,y)?0:255;
  const result=new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels,480,240))));
  assert.equal(result.getText(),"CT-2026-0927");assert.equal(repairScanMatches(result.getText(),orders,origin)[0].id,"CT-2026-0927");
 }
});
test("接机打印二维码实际解码并定位本地记录，未知或外部地址不命中",()=>{
 const id="LOCAL-0123456789ABCDEF", payload=origin+"/app/repairs/"+id;
 const local=[{id,device:{serial:"DEMO-INTAKE-099"}}];
 const {MultiFormatWriter,BarcodeFormat,RGBLuminanceSource,HybridBinarizer,BinaryBitmap,MultiFormatReader}=zxing;
 const matrix=new MultiFormatWriter().encode(payload,BarcodeFormat.QR_CODE,0,0,new Map());
 const scale=8,width=matrix.getWidth()*scale,pixels=new Uint8ClampedArray(width*width);
 for(let y=0;y<width;y++)for(let x=0;x<width;x++)pixels[y*width+x]=matrix.get(Math.floor(x/scale),Math.floor(y/scale))?0:255;
 const decoded=new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels,width,width)))).getText();
 assert.equal(decoded,payload);assert.equal(repairScanMatches(decoded,local,origin)[0].id,id);
 assert.equal(repairScanMatches(origin+"/app/repairs/LOCAL-FFFFFFFFFFFFFFFF",local,origin).length,0);
 assert.equal(repairScanMatches("https://outside.example/app/repairs/"+id,local,origin).length,0);
 assert.equal(decoded.includes("1099"),false);
});
