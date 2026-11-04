import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateNetwork,checkTransactions,readmeSection,saveEvidence,PASSPHRASE} from '../scripts/testnet-support.js';
test('live runner refuses non-Testnet endpoints',()=>{
 assert.throws(()=>validateNetwork({network_passphrase:'Public Global Stellar Network ; September 2015'}),/not Stellar Testnet/);
 assert.throws(()=>validateNetwork({}),/not Stellar Testnet/);
 assert.doesNotThrow(()=>validateNetwork({network_passphrase:PASSPHRASE}));
});
test('verification rejects failed or unidentifiable payments',()=>{
 assert.throws(()=>checkTransactions([{successful:false,transactionHash:'a'.repeat(64)}]));
 assert.throws(()=>checkTransactions([{successful:true,transactionHash:'not-a-hash'}]));
 assert.doesNotThrow(()=>checkTransactions([{successful:true,transactionHash:'a'.repeat(64)}]));
});
const fixture={verifiedAt:'fixture-not-live',accounts:{sender:'fixture',exact:'fixture',partial:'fixture',unpaid:'fixture'},transactions:[{hash:'a'.repeat(64),ledger:1,url:'https://stellar.expert/explorer/testnet/tx/'+'a'.repeat(64)}],verification:{rows:[{id:'test-case',status:'paid'}]}};
test('evidence documentation distinguishes local tool verification from contract deployment',()=>{
 const s=readmeSection('Fixture project',fixture);
 assert.match(s,/no smart contract/);assert.match(s,/testnet\/tx/);assert.match(s,/resets/);
});
test('saving evidence replaces README section rather than duplicating it',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'testnet-doc-test-')),root=pathToFileURL(temp+'/');
 try{
  await writeFile(join(temp,'README.md'),'# Fixture README\n');
  await saveEvidence('Fixture project',root,fixture);await saveEvidence('Fixture project',root,fixture);
  const text=await readFile(join(temp,'README.md'),'utf8');
  assert.equal((text.match(/TESTNET-VERIFICATION:START/g)||[]).length,1);
  assert.equal(JSON.parse(await readFile(join(temp,'docs/testnet/latest.json'),'utf8')).verifiedAt,'fixture-not-live');
 }finally{await rm(temp,{recursive:true,force:true});}
});
