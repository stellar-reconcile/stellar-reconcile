import {execFile} from 'node:child_process';
const allowed=new Set(['horizon-testnet.stellar.org','friendbot.stellar.org','soroban-testnet.stellar.org']);
export function errorCodes(error){
 const found=new Set();
 function visit(e){if(!e||typeof e!=='object')return;if(e.code)found.add(String(e.code));if(e.name==='TimeoutError'||e.name==='AbortError')found.add(e.name);if(e.cause)visit(e.cause);if(Array.isArray(e.errors))e.errors.forEach(visit);}
 visit(error);return [...found].join(', ')||'unknown transport error';
}
export const curlRequest=url=>new Promise((resolve,reject)=>{
 // -q disables personal curl configuration; TLS verification remains enabled.
 execFile('curl',['-q','--ipv4','--silent','--show-error','--proto','=https','--connect-timeout','15','--max-time','45','--max-filesize','16777216','--write-out','\n%{http_code}',url],{timeout:50000,maxBuffer:17000000},(error,stdout)=>{
  if(error){reject(Error('curl exit '+(error.code??'unknown')));return;}
  const split=stdout.lastIndexOf('\n'),status=Number(stdout.slice(split+1)),body=stdout.slice(0,split);
  if(!Number.isInteger(status)||status<100||status>599){reject(Error('Invalid curl HTTP status'));return;}
  resolve({ok:status>=200&&status<300,status,json:async()=>JSON.parse(body)});
 });
});
/** Read-only HTTPS calls to fixed Testnet hosts; native fetch with system curl fallback. */
export async function testnetRequest(url,options={},dependencies={}){
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||!allowed.has(parsed.hostname)||parsed.port||parsed.username||parsed.password)throw Error('Refusing non-Testnet endpoint');
 const fetcher=dependencies.fetcher||fetch, fallback=dependencies.fallback||curlRequest, log=dependencies.log||console.warn;
 try{return await fetcher(url,{...options,redirect:'error',signal:options.signal||AbortSignal.timeout(15000)});}
 catch(error){
  const code=errorCodes(error);
  log('Node HTTPS failed for '+parsed.hostname+' ('+code+'); trying curl over IPv4.');
  try{return await fallback(url);}
  catch(curlError){throw Error('Cannot reach '+parsed.hostname+': Node '+code+'; '+curlError.message+'. Check DNS, proxy, TLS certificates, or try another connection.');}
 }
}
