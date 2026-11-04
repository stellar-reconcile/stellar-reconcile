import test from 'node:test';
import assert from 'node:assert/strict';
import {units,reconcile,parseCsv,reportCsv} from '../src/core.js';
import {fetchPayments} from '../src/horizon.js';
const e={id:'invoice',destination:'G'+'A'.repeat(55),asset:'XLM',amount:'0.3',memoType:'text',memo:'INV'};
const p={...e,id:'op1',amount:'0.1',successful:true};
test('decimal sums are exact',()=>{const r=reconcile([e],[p,{...p,id:'op2',amount:'0.2'}]);assert.equal(r.rows[0].status,'paid');assert.equal(r.rows[0].received,'0.3000000');});
test('duplicate operation delivery counted once; distinct operations counted',()=>{const r=reconcile([{...e,amount:'0.2'}],[p,{...p},{...p,id:'op2'}]);assert.equal(r.rows[0].status,'paid');assert.equal(r.duplicates.length,1);});
test('conflicting duplicate fails closed',()=>assert.throws(()=>reconcile([e],[p,{...p,amount:'0.2'}]),/Conflicting/));
test('wrong issuer and failed transactions never credited',()=>{const asset='USDC:'+'G'+'B'.repeat(55);const r=reconcile([{...e,asset}],[{...p,asset:'USDC:'+'G'+'C'.repeat(55)},{...p,id:'op2',asset,successful:false}]);assert.equal(r.rows[0].status,'unpaid');assert.equal(r.exceptions.length,2);});
test('shared route requires review rather than guessing by amount',()=>{const r=reconcile([e,{...e,id:'other',amount:'0.1'}],[p]);assert.deepEqual(r.rows.map(r=>r.status),['ambiguous','ambiguous']);assert.equal(r.exceptions[0].reason,'ambiguous');});
test('memo type is part of routing identity',()=>{const r=reconcile([{...e,memoType:'id',memo:'1'}],[{...p,memo:'1'}]);assert.equal(r.rows[0].status,'unpaid');});
test('partial overpaid and unpaid are distinct',()=>{for(const [n,status]of [['0.1','partial'],['0.4','overpaid']])assert.equal(reconcile([e],[{...p,amount:n}]).rows[0].status,status);assert.equal(reconcile([e],[]).rows[0].status,'unpaid');});
test('invalid precision, negative, floating point and overflow rejected',()=>{for(const n of ['0.00000001','-1','1e3',1,'922337203686'])assert.throws(()=>units(n));});
test('quoted multiline CSV and CRLF supported',()=>{const rows=parseCsv('id,destination,asset,amount,memoType,memo\r\n"a,b",DEST,XLM,1,text,"line1\nline2"\r\n');assert.equal(rows[0].id,'a,b');assert.equal(rows[0].memo,'line1\nline2');});
test('malformed CSV rejected',()=>{for(const s of ['a,a\n1,2','id,destination,asset,amount,memoType,memo\nx,y','id,destination,asset,amount,memoType,memo\n"x'])assert.throws(()=>parseCsv(s));});
test('CSV output neutralizes formula prefixes',()=>assert.match(reportCsv({rows:[{id:'=SUM(A1)',expected:'1',received:'1',status:'paid',paymentIds:[]}]}),/'=SUM/));
test('memo ID range and text byte limits enforced',()=>{assert.throws(()=>reconcile([{...e,memoType:'id',memo:'18446744073709551616'}],[]));assert.throws(()=>reconcile([{...e,memo:'😀'.repeat(8)}],[]));});
test('Horizon adapter fetches transaction memo and preserves operation IDs',async()=>{
  const seen=[];const fetcher=async url=>{seen.push(String(url));return {ok:true,json:async()=>String(url).includes('/transactions/')?{successful:true,memo_type:'text',memo:'INV'}:{_embedded:{records:[{type:'payment',paging_token:'7',id:'7',to:e.destination,asset_type:'native',amount:'0.3',transaction_hash:'a'.repeat(64),transaction_successful:true}]}}};};
  const r=await fetchPayments(e.destination,{fetcher});assert.equal(r.complete,true);assert.equal(r.nextCursor,'7');assert.equal(reconcile([e],r.payments).rows[0].status,'paid');assert.equal(seen.length,2);
});
test('Horizon HTTP errors and malformed collections fail',async()=>{
  await assert.rejects(fetchPayments(e.destination,{fetcher:async()=>({ok:false,status:429})}),/429/);
  await assert.rejects(fetchPayments(e.destination,{fetcher:async()=>({ok:true,json:async()=>({})})}),/Malformed/);
});
test('Horizon page cap signals incomplete history',async()=>{
  const records=Array.from({length:200},(_,i)=>({type:'create_account',paging_token:String(i+1)}));
  const r=await fetchPayments(e.destination,{maxPages:1,fetcher:async()=>({ok:true,json:async()=>({_embedded:{records}})})});assert.equal(r.complete,false);assert.equal(r.nextCursor,'200');
});
