import {execFile} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fetchPayments} from '../src/horizon.js';
import {testnetRequest} from './testnet-request.js';
export const HORIZON='https://horizon-testnet.stellar.org';
export const PASSPHRASE='Test SDF Network ; September 2015';
const RPC='https://soroban-testnet.stellar.org';
async function json(url){
 const r=await testnetRequest(url);
 if(!r.ok)throw Error('Testnet HTTP '+r.status);return r.json();
}
export function validateNetwork(root){
 if(root.network_passphrase!==PASSPHRASE)throw Error('Refusing to run: endpoint is not Stellar Testnet');
}
export function checkTransactions(payments){
 for(const p of payments)if(!p.successful||!/^[a-f0-9]{64}$/.test(p.transactionHash))throw Error('Unverified payment record');
}
export function cli(args,cwd){
 return new Promise((resolve,reject)=>execFile('stellar',args,{cwd,timeout:120000,maxBuffer:4194304},(error,stdout)=>{
  if(error)reject(Error('Stellar CLI step failed ('+args.slice(0,3).join(' ')+'); check CLI and testnet connectivity. No credentials logged.'));
  else resolve(stdout.trim());
 }));
}
export async function createTestnetFixture(){
 validateNetwork(await json(HORIZON));
 const config=await mkdtemp(join(tmpdir(),'stellar-payment-testnet-'));
 await chmod(config,0o700);const work=join(config,'work');await mkdir(work);
 const common=['--config-dir',config,'--no-cache'];
 const network=['--rpc-url',RPC,'--network-passphrase',PASSPHRASE];
 const command=args=>cli([...args,...common],work);
 try{
  const names=['sender','exact','partial','unpaid'],accounts={};
  for(const name of names){
   await command(['keys','generate',name]);
   const address=await command(['keys','address',name]);
   if(!/^G[A-Z2-7]{55}$/.test(address))throw Error('Invalid public address from CLI');
   accounts[name]=address;
  }
  console.log('Funding a fresh TESTNET sender with Friendbot. No real funds used.');
  await json('https://friendbot.stellar.org/?addr='+accounts.sender);
  for(const name of names.slice(1))await command(['tx','new','create-account','--source-account','sender','--destination',accounts[name],'--starting-balance','10000000',...network]);
  for(const [name,stroops] of [['exact','100000000'],['partial','80000000']]){
   console.log('Submitting '+name+' test-only payment.');
   await command(['tx','new','payment','--source-account','sender','--destination',accounts[name],'--amount',stroops,...network]);
  }
  const payments=[];
  for(const name of names.slice(1)){
   let data;
   for(let attempt=0;attempt<20;attempt++){
    data=await fetchPayments(accounts[name],{network:'testnet',fetcher:testnetRequest});
    if(!data.complete)throw Error('Incomplete payment history');
    if(name==='unpaid'||data.payments.length)break;
    await delay(3000);
   }
   if(name!=='unpaid'&&!data.payments.length)throw Error('Horizon indexing deadline exceeded');
   payments.push(...data.payments);
  }
  checkTransactions(payments);
  if(payments.length!==2)throw Error('Expected exactly two fresh payment operations');
  const expected=[
   {id:'testnet-exact',destination:accounts.exact,asset:'XLM',amount:'10.0000000',memoType:'none',memo:''},
   {id:'testnet-partial',destination:accounts.partial,asset:'XLM',amount:'20.0000000',memoType:'none',memo:''},
   {id:'testnet-unpaid',destination:accounts.unpaid,asset:'XLM',amount:'30.0000000',memoType:'none',memo:''}
  ];
  const transactions=[];
  for(const hash of [...new Set(payments.map(p=>p.transactionHash))]){
   const tx=await json(HORIZON+'/transactions/'+hash);
   if(tx.hash!==hash||tx.successful!==true)throw Error('On-chain confirmation failed');
   transactions.push({hash,ledger:tx.ledger,createdAt:tx.created_at,successful:true,url:'https://stellar.expert/explorer/testnet/tx/'+hash,horizon:HORIZON+'/transactions/'+hash});
  }
  return {schemaVersion:1,network:'testnet',networkPassphrase:PASSPHRASE,horizon:HORIZON,rpc:RPC,verifiedAt:new Date().toISOString(),accounts,expected,payments,transactions};
 }finally{await rm(config,{recursive:true,force:true});}
}
export function readmeSection(project,evidence){
 const rows=evidence.verification.rows||evidence.verification.results;
 return [
 '<!-- TESTNET-VERIFICATION:START -->','## Verified Stellar Testnet run','',
 'Verified at: '+evidence.verifiedAt,'',
 'Live testnet integration demonstration of '+project+'. This project deploys no smart contract and has no contract ID. It runs locally against Testnet, rather than as a hosted service.','',
 '- Horizon: '+HORIZON,'- Network passphrase: '+PASSPHRASE,
 '- Public sender: '+evidence.accounts.sender,
 '- Exact-payment recipient: '+evidence.accounts.exact,
 '- Partial-payment recipient: '+evidence.accounts.partial,
 '- Unpaid recipient: '+evidence.accounts.unpaid,'',
 'Confirmed testnet payment transactions:',
 ...evidence.transactions.map(t=>'- ['+t.hash+']('+t.url+') — ledger '+t.ledger),'',
 'Observed results: '+rows.map(r=>(r.id||r.name)+': '+(r.status||(r.passed?'passed':'failed'))).join('; ')+'.','',
 'Evidence: [latest.json](docs/testnet/latest.json). Rerun with node scripts/testnet-run.js (Node.js 22+ and Stellar CLI 27+). Fresh test-only identities are temporary and excluded from evidence. Funding uses free Friendbot XLM.','',
 'This verifies native XLM exact/partial/unpaid handling. It does not establish live issued-asset, path-payment, muxed-address, Soroban-transfer, failure or concurrency coverage. Offline tests cover additional cases. Testnet resets can remove accounts and history.',
 '<!-- TESTNET-VERIFICATION:END -->'].join('\n');
}
export async function saveEvidence(project,root,evidence,{log=console.log}={}){
 const docs=new URL('docs/testnet/',root);await mkdir(docs,{recursive:true});
 await writeFile(new URL('latest.json',docs),JSON.stringify(evidence,null,2)+'\n');
 const path=new URL('README.md',root);let previous=await readFile(path,'utf8');
 previous=previous.replace('No live network smoke test or on-chain testnet demonstration has been completed. Horizon behavior is currently covered by mocked integration tests.', 'A native-XLM testnet demonstration is recorded below. Browser verification remains pending; automated tests also cover mocked Horizon behavior.').replace('No real testnet verification has been performed. Actual network and SDK adapters are planned.', 'Native-XLM testnet ingestion and reference-adapter verification are recorded below. External application and SDK adapters remain planned.').replace('**Status: pending execution.** No testnet run is claimed by this section.', '**Status: verified.** Public evidence is recorded in the generated section below.');
 const block=readmeSection(project,evidence),pattern=/<!-- TESTNET-VERIFICATION:START -->[\s\S]*?<!-- TESTNET-VERIFICATION:END -->/;
 await writeFile(path,pattern.test(previous)?previous.replace(pattern,()=>block):previous.trimEnd()+'\n\n'+block+'\n');
 log('LIVE verification complete: docs/testnet/latest.json and README updated.');
}
