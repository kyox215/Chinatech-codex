// Generator/test reference only. The web runtime does not import this module.
export function unicode17Reference(data){
 const records=new Map(data.rows.map(row=>[row[0],row])),composites=new Map(data.composition.map(([a,b,c])=>[a+':'+b,c])),needs=new Set(data.normalNeeds);
 const nfkc=input=>{
  if(![...input].some(char=>needs.has(char.codePointAt(0))))return input;
  const decomposed=[];for(const char of input){const point=char.codePointAt(0),index=point-0xac00,value=index>=0&&index<11172?String.fromCodePoint(0x1100+Math.floor(index/588),0x1161+Math.floor(index%588/28),...(index%28?[0x11a7+index%28]:[])):records.get(point)?.[1]??char;for(const part of value)decomposed.push({point:part.codePointAt(0),ccc:records.get(part.codePointAt(0))?.[2]??0,order:decomposed.length});}
  let group=0;for(const char of decomposed){if(!char.ccc)group++;char.group=group;}decomposed.sort((a,b)=>a.group-b.group||a.ccc-b.ccc||a.order-b.order);
  const result=[];let starter=-1,lastClass=0;
  for(const {point,ccc}of decomposed){let composite;
   if(starter>=0&&(lastClass<ccc||!lastClass)){const previous=result[starter];if(previous>=0x1100&&previous<0x1113&&point>=0x1161&&point<0x1176)composite=0xac00+((previous-0x1100)*21+point-0x1161)*28;else if(previous>=0xac00&&previous<=0xd7a3&&(previous-0xac00)%28===0&&point>=0x11a8&&point<0x11c3)composite=previous+point-0x11a7;else composite=composites.get(previous+':'+point);}
   if(composite!==undefined){result[starter]=composite;continue;}if(ccc===0)starter=result.length;result.push(point);lastClass=ccc;
  }
  return String.fromCodePoint(...result);
 };
 const lower=input=>{const chars=[...input];return chars.map((char,index)=>{if(char==='Σ'){let before=index-1,after=index+1;while(before>=0&&/\p{Case_Ignorable}/u.test(chars[before]))before--;while(after<chars.length&&/\p{Case_Ignorable}/u.test(chars[after]))after++;if(before>=0&&/\p{Cased}/u.test(chars[before])&&(after===chars.length||!/\p{Cased}/u.test(chars[after])))return'ς';}return records.get(char.codePointAt(0))?.[3]??char;}).join('');};
 return{nfkc,lower,upper:input=>[...input].map(char=>records.get(char.codePointAt(0))?.[4]??char).join('')};
}
