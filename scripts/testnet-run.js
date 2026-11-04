import assert from 'node:assert/strict';
import {reconcile} from '../src/core.js';
import {createTestnetFixture,saveEvidence} from './testnet-support.js';
try{
 const evidence=await createTestnetFixture(),verification=reconcile(evidence.expected,evidence.payments);
 assert.deepEqual(verification.rows.map(r=>r.status),['paid','partial','unpaid']);
 assert.deepEqual(verification.rows.map(r=>r.received),['10.0000000','8.0000000','0.0000000']);
 assert.equal(verification.exceptions.length,0);evidence.verification=verification;
 await saveEvidence('Stellar Reconcile',new URL('../',import.meta.url),evidence);
}catch(e){console.error('Testnet verification failed: '+e.message);process.exitCode=1;}
