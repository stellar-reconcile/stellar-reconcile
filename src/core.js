export function units(v) {
  if(typeof v!=='string'||!/^(0|[1-9]\d*)(\.\d{1,7})?$/.test(v))throw Error('Invalid amount: '+v);
  const [w,f='']=v.split('.');const n=BigInt(w)*10000000n+BigInt(f.padEnd(7,'0'));
  if(n>9223372036854775807n)throw Error('Amount exceeds int64');return n;
}
export function amount(n){return (n/10000000n)+'.'+(n%10000000n).toString().padStart(7,'0');}
function validate(p,expected=false){
  if(!p||typeof p.id!=='string'||!p.id.trim())throw Error('Missing record id');
  if(typeof p.destination!=='string'||!p.destination)throw Error('Missing destination: '+p.id);
  if(typeof p.asset!=='string'||(p.asset!=='XLM'&&!/^[A-Za-z0-9]{1,12}:[A-Z2-7]{56}$/.test(p.asset)))throw Error('Asset must be XLM or CODE:ISSUER');
  if(typeof p.memo!=='string'||!['none','text','id','hash','return'].includes(p.memoType))throw Error('Invalid memo');
  if(p.memoType==='none'&&p.memo!=='')throw Error('None memo must be empty');
  if(p.memoType==='id'&&(!/^(0|[1-9]\d*)$/.test(p.memo)||BigInt(p.memo)>18446744073709551615n))throw Error('Invalid memo ID');
  if(p.memoType==='text'&&new TextEncoder().encode(p.memo).length>28)throw Error('Text memo exceeds 28 bytes');
  if(['hash','return'].includes(p.memoType)&&!/^[A-Za-z0-9+/]{43}=$/.test(p.memo))throw Error('Hash memo must encode 32 bytes');
  if(units(p.amount)<=0n)throw Error('Amount must be positive');
  if(!expected&&typeof p.successful!=='boolean')throw Error('Missing payment success flag');
}
const route=p=>JSON.stringify([p.destination,p.asset,p.memoType,p.memo]);
export function reconcile(expected,payments){
  if(!Array.isArray(expected)||!Array.isArray(payments))throw Error('Inputs must be arrays');
  const routes=new Map(),ids=new Set(),seen=new Map(),assigned=new Map(),duplicates=[],exceptions=[];
  for(const e of expected){validate(e,true);if(ids.has(e.id))throw Error('Duplicate expected id');ids.add(e.id);const k=route(e);routes.set(k,[...(routes.get(k)||[]),e]);}
  for(const p of payments){
    validate(p);
    if(seen.has(p.id)){if(JSON.stringify(seen.get(p.id))!==JSON.stringify(p))throw Error('Conflicting payment id: '+p.id);duplicates.push(p.id);continue;}
    seen.set(p.id,p);
    if(!p.successful){exceptions.push({id:p.id,reason:'failed'});continue;}
    const cs=routes.get(route(p))||[];
    if(cs.length!==1){exceptions.push({id:p.id,reason:cs.length?'ambiguous':'unmatched',candidates:cs.map(e=>e.id)});continue;}
    assigned.set(cs[0].id,[...(assigned.get(cs[0].id)||[]),p]);
  }
  const rows=expected.map(e=>{
    const ps=assigned.get(e.id)||[],n=ps.reduce((s,p)=>s+units(p.amount),0n),due=units(e.amount);
    const status=routes.get(route(e)).length>1?'ambiguous':n===0n?'unpaid':n<due?'partial':n===due?'paid':'overpaid';
    return {id:e.id,expected:e.amount,received:amount(n),status,paymentIds:ps.map(p=>p.id)};
  });
  return {rows,exceptions,duplicates,summary:rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})};
}
export function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false,closed=false;text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
    if(c==='"'){if(field||closed)throw Error('Unexpected CSV quote');quoted=true;continue;}
    if(c===','||c==='\n'||c==='\r'){row.push(field);field='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}continue;}
    if(closed)throw Error('Text after closing CSV quote');field+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(field||row.length||closed){row.push(field);rows.push(row);}
  if(!rows.length)throw Error('Empty CSV');
  const headers=rows.shift();
  if(new Set(headers).size!==headers.length||headers.some(h=>!h))throw Error('Invalid CSV headers');
  for(const h of ['id','destination','asset','amount','memoType','memo'])if(!headers.includes(h))throw Error('Missing CSV column: '+h);
  return rows.map(r=>{if(r.length!==headers.length)throw Error('CSV column mismatch');return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));});
}
export function reportCsv(report){
  const cell=v=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  return [['id','expected','received','status','paymentIds'],...report.rows.map(r=>[r.id,r.expected,r.received,r.status,r.paymentIds.join(';')])].map(r=>r.map(cell).join(',')).join('\n')+'\n';
}
