import test from 'node:test';
import assert from 'node:assert/strict';
import {testnetRequest,errorCodes} from '../scripts/testnet-request.js';
const response={ok:true,status:200,json:async()=>({network_passphrase:'test'})};
const quiet=()=>{};
test('testnet HTTP preserves native successful responses',async()=>{
 let fallback=false;
 assert.equal(await testnetRequest('https://horizon-testnet.stellar.org',{}, {fetcher:async()=>response,fallback:async()=>{fallback=true;},log:quiet}),response);
 assert.equal(fallback,false);
});
test('testnet HTTP uses fallback on transport errors and retains diagnostic codes',async()=>{
 const failure=new TypeError('fetch failed',{cause:{code:'ENETUNREACH'}});
 const logs=[];let called=false;
 const r=await testnetRequest('https://horizon-testnet.stellar.org',{}, {fetcher:async()=>{throw failure;},fallback:async()=>{called=true;return response;},log:s=>logs.push(s)});
 assert.equal(r,response);assert.equal(called,true);assert.match(logs[0],/ENETUNREACH/);
 await assert.rejects(testnetRequest('https://horizon-testnet.stellar.org',{}, {fetcher:async()=>{throw failure;},fallback:async()=>{throw Error('curl exit 6');},log:quiet}),/ENETUNREACH.*curl exit 6/);
});
test('HTTP errors do not trigger hidden retry',async()=>{
 const r=await testnetRequest('https://horizon-testnet.stellar.org',{}, {fetcher:async()=>({ok:false,status:429}),fallback:async()=>{throw Error('must not run');},log:quiet});assert.equal(r.status,429);
});
test('testnet HTTP rejects arbitrary hosts credentials ports and HTTP',async()=>{
 for(const url of ['https://horizon.stellar.org','http://horizon-testnet.stellar.org','https://name:secret@horizon-testnet.stellar.org','https://horizon-testnet.stellar.org:444'])await assert.rejects(testnetRequest(url),/Refusing/);
 assert.equal(errorCodes({cause:{errors:[{code:'ETIMEDOUT'},{code:'ENETUNREACH'}]}}),'ETIMEDOUT, ENETUNREACH');
});
