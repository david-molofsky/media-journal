import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import { importedFromTag } from '@/utils/importedFromTag';

export interface DisneyPlusItem { key:string; title:string; mediaType:'film'|'tv'; startedDate:string; completedDate:string; profile:string; sessionCount:number }
export interface DisneyPlusPreview { films:number; shows:number; ignored:number; rows:number }
const decode=(s:string)=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const attrs=(s:string)=>Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1]!,decode(m[2]!)]));
const tag=(s:string,n:string)=>new RegExp('<'+n+'\\b[^>]*>([\\s\\S]*?)</'+n+'>','i').exec(s)?.[1]??'';
async function unzip(buffer:ArrayBuffer){
 const b=new Uint8Array(buffer),v=new DataView(buffer); let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break}
 if(end<0)throw Error('This is not a valid .xlsx workbook.');
 const files=new Map<string,string>(),decoder=new TextDecoder();let p=v.getUint32(end+16,true);
 for(let i=0;i<v.getUint16(end+10,true);i++){
  if(v.getUint32(p,true)!==0x02014b50)throw Error('The spreadsheet archive could not be read.');
  const method=v.getUint16(p+10,true),size=v.getUint32(p+20,true),nl=v.getUint16(p+28,true),el=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),off=v.getUint32(p+42,true),name=decoder.decode(b.slice(p+46,p+46+nl));
  const data=off+30+v.getUint16(off+26,true)+v.getUint16(off+28,true),raw=b.slice(data,data+size);p+=46+nl+el+cl;
  if(method===0)files.set(name,decoder.decode(raw));
  else if(method===8){if(typeof DecompressionStream==='undefined')throw Error('This browser cannot unpack Excel files.');const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));files.set(name,decoder.decode(await new Response(stream).arrayBuffer()))}
 }
 return files;
}
function col(ref:string){return [...(ref.match(/^[A-Z]+/)?.[0]??'A')].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1}
function cell(s:string,shared:string[]){const a=attrs(/^<c\b([^>]*)/.exec(s)?.[1]??''),v=decode(tag(s,'v'));return a.t==='s'?(shared[+v]??''):a.t==='inlineStr'?decode(tag(s,'t')):v}
export async function parseDisneyPlusWorkbook(buffer:ArrayBuffer,range:{startDate?:string;endDate?:string}={}):Promise<{items:DisneyPlusItem[];preview:DisneyPlusPreview}>{
 if(range.startDate&&range.endDate&&range.startDate>range.endDate)throw Error('Start date must be on or before end date.');
 const files=await unzip(buffer),shared=[...(files.get('xl/sharedStrings.xml')??'').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1]!.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t=>decode(t[1]!)).join(''));
 const xml=[...files.entries()].find(([n])=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n))?.[1];if(!xml)throw Error('No worksheet was found in this Excel file.');
 const rows=[...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(m=>{const r=new Map<number,string>();for(const c of m[1]!.matchAll(/<c\b[^>]*>[\s\S]*?<\/c>|<c\b[^>]*\/>/g)){const ref=attrs(/^<c\b([^>]*)/.exec(c[0])?.[1]??'').r??'A';r.set(col(ref),cell(c[0],shared))}return r});
 if(!rows.length)throw Error('The worksheet is empty.');
 const h=Object.fromEntries([...rows[0]!.entries()].map(([i,x])=>[x.trim(),i]));
 for(const k of ['date','profile_id','program_title','program_type','create_ts','end_ts'])if(h[k]===undefined)throw Error('Missing expected Disney+ column: '+k);
 const read=(r:Map<number,string>,k:string)=>r.get(h[k]!)?.trim()??'';
 const all=rows.slice(1).map(r=>({date:read(r,'date').slice(0,10),profile:read(r,'profile_id')||'Unknown',title:read(r,'program_title'),series:read(r,'season_title'),type:read(r,'program_type').toLowerCase(),start:read(r,'create_ts'),end:read(r,'end_ts')})).filter(r=>r.date&&r.title);
 const data=all.filter(r=>(!range.startDate||r.date>=range.startDate)&&(!range.endDate||r.date<=range.endDate));
 const films=data.filter(r=>r.type==='movie'),episodes=data.filter(r=>r.type==='episode'&&r.series);
 const ignored=data.length-films.length-episodes.length,ms=(s:string)=>{const n=Date.parse(s);return Number.isFinite(n)?n:0};
 const items:DisneyPlusItem[]=[];
 const groups=new Map<string,typeof films>();
 for(const r of films){const k=r.profile+'|'+r.title.toLowerCase(),g=groups.get(k)??[];g.push(r);groups.set(k,g)}
 for(const [key,g] of groups){g.sort((a,b)=>ms(a.start)-ms(b.start));let session:typeof g=[];
  const save=()=>{if(!session.length)return;const first=session.reduce((a,b)=>ms(a.start)<=ms(b.start)?a:b),last=session.reduce((a,b)=>ms(a.end)>=ms(b.end)?a:b),start=(first.start||first.date).slice(0,10),finish=(last.end||last.date).slice(0,10);items.push({key:'film|'+key+'|'+start+'|'+finish,title:first.title,mediaType:'film',startedDate:start,completedDate:finish,profile:first.profile,sessionCount:session.length});session=[]};
  for(const r of g){const prev=session.at(-1);if(prev&&ms(r.start)&&ms(prev.end)&&ms(r.start)-ms(prev.end)>45*60*1000)save();session.push(r)}save()
 }
 const shows=new Map<string,typeof episodes>();
 for(const r of episodes){const k=r.profile+'|'+r.series.toLowerCase(),g=shows.get(k)??[];g.push(r);shows.set(k,g)}
 for(const [key,g] of shows){const first=g.reduce((a,b)=>ms(a.start)<=ms(b.start)?a:b),last=g.reduce((a,b)=>ms(a.end)>=ms(b.end)?a:b);items.push({key:'tv|'+key,title:first.series,mediaType:'tv',startedDate:(first.start||first.date).slice(0,10),completedDate:(last.end||last.date).slice(0,10),profile:first.profile,sessionCount:g.length})}
 const existing=await db.mediaEntries.toArray(),keys=new Set(existing.map(e=>e.metadata.disneyPlusImportKey).filter((k):k is string=>typeof k==='string')),filmKeys=new Set(existing.filter(e=>e.mediaType==='film').map(e=>e.title.trim().toLowerCase()+'|'+e.startedDate+'|'+e.completedDate));
 const fresh=items.filter(i=>!keys.has(i.key)&&!(i.mediaType==='film'&&filmKeys.has(i.title.trim().toLowerCase()+'|'+i.startedDate+'|'+i.completedDate)));
 return {items:fresh,preview:{films:fresh.filter(i=>i.mediaType==='film').length,shows:fresh.filter(i=>i.mediaType==='tv').length,ignored,rows:data.length}};
}
export async function applyDisneyPlusImport(items:DisneyPlusItem[]){for(const i of items)await createEntry({title:i.title,mediaType:i.mediaType,status:'completed',startedDate:i.startedDate,completedDate:i.completedDate,repeatConsumption:false,tags:[importedFromTag('Disney+')],genres:[],watchedWith:[],recommendedBy:[],metadata:{source:'Disney+',disneyPlusImportKey:i.key,disneyPlusProfile:i.profile,disneyPlusActivityRows:i.sessionCount}});return items.length}
