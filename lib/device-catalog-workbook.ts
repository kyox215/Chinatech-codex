import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { translate } from './i18n/translate';
import type { Locale } from './i18n/locale';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { CatalogError, catalogCategory, validateCatalogEntry, type CatalogImportRow, type CatalogRow } from './device-catalog';
export const catalogColumns = [
  ['id','目录ID'],['category','设备类别'],['brand','品牌'],['family','系列'],['name','完整型号'],
  ['releasedAt','发布日期'],['year','年份'],['generation','代际'],['network','网络'],['platform','硬件版本'],
  ['modelCodes','机型码'],['aliases','搜索别名'],['markets','销售地区'],['status','核验状态'],['enabled','候选启用'],
  ['sourceUrls','来源链接'],['checkedAt','核验日期'],['notes','备注'],['version','行版本'],
] as const;
const lists = new Set(['modelCodes','aliases','markets','sourceUrls']);
const xml = (value: unknown) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function column(index:number):string { let name='';for(let n=index+1;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name; }
export function catalogTable(rows: readonly CatalogRow[],locale:Locale='zh-CN') {
  return [catalogColumns.map(([key,label])=>`${translate(label,locale)} [${key}]`),...rows.map(row=>catalogColumns.map(([key])=>{
    const value=row[key]; return Array.isArray(value)?value.join('\n'):value===null?'':typeof value==='boolean'?value?'1':'0':String(value);
  }))];
}
export function writeCatalogCsv(rows:readonly CatalogRow[],locale:Locale='zh-CN') { return '\ufeff'+catalogTable(rows,locale).map(row=>row.map(value=>'"'+(/^[=+\-@\t\r]/u.test(value)?"'"+value:value).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n'; }
export function writeCatalogWorkbook(rows:readonly CatalogRow[],revision:string,locale:Locale='zh-CN') {
  const table=catalogTable(rows,locale); const last=column(catalogColumns.length-1); const sheetRows=table.map((values,index)=>`<row r="${index+1}" ht="${index?30:34}" customHeight="1">${values.map((value,col)=>`<c r="${column(col)}${index+1}" t="inlineStr" s="${index?1:2}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`).join('');
  const files:Record<string,Uint8Array>={}; const put=(name:string,value:string)=>files[name]=strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+value);
  put('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
  put('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  put('xl/workbook.xml',`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(translate('型号主表',locale))}" sheetId="1" r:id="rId1"/><sheet name="${xml(translate('维护说明',locale))}" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  put('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  put('xl/styles.xml','<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/><color rgb="FF202231"/></font><font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF5F57FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>');
  put('xl/worksheets/sheet1.xml',`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}${table.length}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="5" ySplit="1" topLeftCell="F2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>${catalogColumns.map(([key],index)=>`<col min="${index+1}" max="${index+1}" width="${key==='name'?38:key==='sourceUrls'?55:key==='id'?42:22}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${last}${table.length}"/></worksheet>`);
  const notes=[['目录版本',revision],['维护入口','只修改型号主表；目录ID和行版本保留，新行ID留空、行版本填0。'],['候选启用','1=启用；0=停用。漏掉某行不会删除该型号。'],['设备类别','phone / tablet / laptop / desktop / console / other'],['网络','unknown / 2G / 3G / 4G / 5G / Wi-Fi / Wi-Fi + Cellular'],['核验状态','verified=已核验，需要来源和核验日期；review=待核对。'],['数组字段','机型码、别名、地区和来源每项换行；不要把多个硬件不同型号放入同一行。'],['日期与代码','日期YYYY-MM-DD，未知留空；所有单元格按文本保存，避免丢失代码前导零。'],['保存边界','导入后先预览，确认才整批保存；目录维护不改写旧商品、工单、销售或打印快照。']];
  put('xl/worksheets/sheet2.xml',`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="2" width="100" customWidth="1"/></cols><sheetData>${notes.map((row,index)=>`<row r="${index+1}" ht="42" customHeight="1">${row.map((value,col)=>`<c r="${column(col)}${index+1}" t="inlineStr" s="1"><is><t>${xml(translate(value,locale))}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`);
  return zipSync(files,{level:6});
}
function guardZip(bytes:Uint8Array):Map<string,number> {
  if(bytes.byteLength>4*1024*1024 || bytes.byteLength<22)throw new CatalogError('Excel文件超过允许大小或格式无效。');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw new CatalogError('Excel压缩文件格式无效。');
  const count=view.getUint16(end+10,true),onDisk=view.getUint16(end+8,true);
  const size=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);
  if(view.getUint16(end+4,true)!==0 || view.getUint16(end+6,true)!==0 || !count || count!==onDisk || count===0xffff || count>100
    || size===0xffffffff || offset===0xffffffff || end+22+view.getUint16(end+20,true)!==bytes.length
    || offset>=end || offset+size!==end)throw new CatalogError('Excel压缩文件格式无效。');
  const sizes=new Map<string,number>();let position=offset,total=0;
  for(let i=0;i<count;i++) {
    if(position+46>end || view.getUint32(position,true)!==0x02014b50)throw new CatalogError('Excel压缩文件格式无效。');
    const flags=view.getUint16(position+8,true),method=view.getUint16(position+10,true);
    const compressed=view.getUint32(position+20,true),original=view.getUint32(position+24,true);
    const nameLength=view.getUint16(position+28,true),extra=view.getUint16(position+30,true),comment=view.getUint16(position+32,true);
    const localOffset=view.getUint32(position+42,true),extraStart=position+46+nameLength;
    if(position+46+nameLength+extra+comment>end || flags&0x2041 || ![0,8].includes(method)
      || view.getUint16(position+34,true)!==0 || compressed===0xffffffff || original===0xffffffff || localOffset===0xffffffff
      || localOffset+30>=offset || view.getUint32(localOffset,true)!==0x04034b50)throw new CatalogError('不支持加密或超大Excel文件。');
    for(let cursor=extraStart;cursor<extraStart+extra;){
      if(cursor+4>extraStart+extra)throw new CatalogError('Excel压缩文件格式无效。');
      const field=view.getUint16(cursor,true),length=view.getUint16(cursor+2,true);cursor+=4;
      if(field===1 || cursor+length>extraStart+extra)throw new CatalogError('不支持ZIP64格式Excel文件。');
      cursor+=length;
    }
    const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true);
    const localExtraStart=localOffset+30+localNameLength;
    if(view.getUint32(localOffset+18,true)===0xffffffff || view.getUint32(localOffset+22,true)===0xffffffff
      || localExtraStart+localExtraLength>offset)throw new CatalogError('不支持ZIP64格式Excel文件。');
    for(let cursor=localExtraStart;cursor<localExtraStart+localExtraLength;){
      if(cursor+4>localExtraStart+localExtraLength)throw new CatalogError('Excel压缩文件格式无效。');
      const field=view.getUint16(cursor,true),length=view.getUint16(cursor+2,true);cursor+=4;
      if(field===1 || cursor+length>localExtraStart+localExtraLength)throw new CatalogError('不支持ZIP64格式Excel文件。');
      cursor+=length;
    }
    const localName=bytes.subarray(localOffset+30,localOffset+30+localNameLength);
    const centralName=bytes.subarray(position+46,extraStart);
    if(localNameLength!==nameLength || localName.some((byte,index)=>byte!==centralName[index])
      || view.getUint16(localOffset+6,true)!==flags || view.getUint16(localOffset+8,true)!==method
      || localOffset+30+localNameLength+localExtraLength+compressed>offset)throw new CatalogError('Excel压缩文件格式无效。');
    const name=strFromU8(centralName);total+=original;
    if(total>20*1024*1024 || !name || name.length>512 || name.includes('..') || name.includes('\\') || name.startsWith('/') || /\.(bin|vba|exe)$/i.test(name) || sizes.has(name))throw new CatalogError('Excel文件内容超过允许范围。');
    sizes.set(name,original);
    position+=46+nameLength+extra+comment;
  }
  if(position!==end)throw new CatalogError('Excel压缩文件格式无效。');
  return sizes;
}
type XmlNode = Record<string,unknown>;
const list=(node:unknown):unknown[]=>node===undefined?[]:Array.isArray(node)?node:[node];
const node=(value:unknown):XmlNode=>value&&typeof value==='object'&&!Array.isArray(value)?value as XmlNode:{};
const content=(value:unknown):string=>typeof value==='string'||typeof value==='number'?String(value):typeof value==='object'&&value!==null?content(node(value)['#text']):'';
function richText(value:unknown):string { const item=node(value);return content(item.t)||list(item.r).map(run=>content(node(run).t)).join(''); }
function parseXml(value:string):XmlNode {
  if(/<!DOCTYPE|<!ENTITY/i.test(value) || XMLValidator.validate(value)!==true)throw new CatalogError('Excel XML内容无效。');
  return new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,parseAttributeValue:false,trimValues:false}).parse(value) as XmlNode;
}
export function readCatalogWorkbook(bytes:Uint8Array): { rows:CatalogImportRow[]; errors:{row:number;message:string}[] } {
  const expected=guardZip(bytes);let files:Record<string,Uint8Array>;let total=0;
  try{files=unzipSync(bytes,{filter:file=>{
    if(!expected.has(file.name) || expected.get(file.name)!==file.originalSize)throw new CatalogError('Excel压缩文件格式无效。');
    total+=file.originalSize;if(total>20*1024*1024)throw new CatalogError('Excel文件内容超过允许范围。');
    return /\.(xml|rels)$/i.test(file.name);
  }});}catch{throw new CatalogError('Excel压缩文件格式无效。');}
  if(Object.values(files).reduce((sum,file)=>sum+file.byteLength,0)>20*1024*1024)throw new CatalogError('Excel文件内容超过允许范围。');
  const read=(name:string)=>{if(!files[name])throw new CatalogError('Excel缺少型号主表。');return parseXml(strFromU8(files[name]));};
  const workbook=node(read('xl/workbook.xml').workbook); const sheet=list(node(workbook.sheets).sheet).map(node).find(item=>String(item['@_sheetId'])==='1');
  if(!sheet)throw new CatalogError('请使用导出的型号主表模板。');
  const relationships=list(node(read('xl/_rels/workbook.xml.rels').Relationships).Relationship).map(node);
  const rel=relationships.find(item=>item['@_Id']===(sheet['@_id']??sheet['@_r:id'])); const target=content(rel?.['@_Target']);
  if(!rel || rel['@_TargetMode']==='External' || !/^(?:\/xl\/)?(?:worksheets\/sheet[^/]+\.xml)$/.test(target))throw new CatalogError('Excel型号主表位置无效。');
  const sheetPath=target.startsWith('/xl/')?target.slice(1):'xl/'+target; const worksheet=node(read(sheetPath).worksheet);
  const shared=files['xl/sharedStrings.xml']?list(node(read('xl/sharedStrings.xml').sst).si).map(richText):[];
  const rawRows=list(node(worksheet.sheetData).row).map(node);if(rawRows.length>10001)throw new CatalogError('一次导入须为1至10000行。');
  const values=rawRows.map(row=>{
    const result:string[]=[];for(const cell of list(row.c).map(node)) {
      if(cell.f!==undefined)throw new CatalogError('型号主表只接受数据，不接受公式。');
      const reference=content(cell['@_r']);if(!/^[A-Z]{1,3}[1-9]\d{0,5}$/.test(reference))throw new CatalogError('Excel单元格位置无效。');
      let col=0;for(const char of reference.replace(/\d/g,''))col=col*26+char.charCodeAt(0)-64;col--;
      if(col>catalogColumns.length+10)throw new CatalogError('Excel主表列数无效。');
      const value=content(cell.v);result[col]=cell['@_t']==='inlineStr'?richText(cell.is):cell['@_t']==='s'?shared[Number(value)]??'':value;
    }return result;
  });
  const header=values.shift()??[];const positions=catalogColumns.map(([key,label])=>header.findIndex(value=>value===key||value===label||value?.endsWith(` [${key}]`)));
  if(positions.some(position=>position<0) || new Set(positions).size!==positions.length)throw new CatalogError('Excel列名缺失或重复，请使用导出的模板。');
  const rows:CatalogImportRow[]=[];const errors:{row:number;message:string}[]=[];
  values.forEach((cells,index)=>{if(cells.every(value=>!value?.trim()))return;try {
    const raw:Record<string,unknown>={};catalogColumns.forEach(([key],col)=>{const value=cells[positions[col]]??'';
      raw[key]=lists.has(key)?value.split(/\r?\n/u).map(item=>item.trim()).filter(Boolean):value;
    });
    raw.category=catalogCategory(String(raw.category))??raw.category;
    raw.status=raw.status==='已核验'?'verified':raw.status==='待核对'?'review':raw.status;
    raw.network=raw.network==='未知'?'unknown':raw.network;
    if(!['0','1','true','false','是','否'].includes(String(raw.enabled)))throw new CatalogError('候选启用须为1或0。');
    raw.enabled=['1','true','是'].includes(String(raw.enabled));raw.year=raw.year===''?null:Number(raw.year);
    for(const field of ['releasedAt','checkedAt']) { const value=String(raw[field]);raw[field]=!value?null:/^\d+(?:\.0+)?$/.test(value)&&Number(value)>=25569&&Number(value)<120000?new Date((Number(value)-25569)*86400000).toISOString().slice(0,10):/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0+)?Z$/.test(value)?value.slice(0,10):value; }
    const expectedVersion=raw.version===''?0:Number(raw.version);delete raw.version;
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new CatalogError('目录行版本无效。');
    rows.push({entry:validateCatalogEntry(raw),expectedVersion});
  }catch(error){errors.push({row:Number(rawRows[index+1]?.['@_r'])||index+2,message:error instanceof CatalogError?error.message:'目录行格式无效。'});}});
  if(!rows.length&&!errors.length)throw new CatalogError('型号主表为空。');return {rows,errors};
}
