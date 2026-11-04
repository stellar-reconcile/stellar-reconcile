import {parseCsv,reconcile,reportCsv} from '/core.js';
import {fetchPayments} from '/horizon.js';
const $=id=>document.getElementById(id);
let expected=null,payments=null,report=null;
const say=s=>$('message').textContent=s;
function clear(){report=null;$('export').disabled=true;$('rows').replaceChildren();$('metrics').replaceChildren();$('exceptions').textContent='Run a reconciliation to review exceptions.';}
function render(){
  clear();report=reconcile(expected,payments);
  for(const [status,count] of Object.entries(report.summary)){const card=document.createElement('div');card.className='metric';const n=document.createElement('strong');n.textContent=count;card.append(n,document.createTextNode(status));$('metrics').append(card);}
  for(const r of report.rows){const tr=document.createElement('tr');for(const value of [r.id,r.expected,r.received,r.status,r.paymentIds.join(', ')||'—']){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('rows').append(tr);}
  $('exceptions').textContent=JSON.stringify({exceptions:report.exceptions,duplicates:report.duplicates},null,2);$('export').disabled=false;
  say('Reconciled '+report.rows.length+' expected payments. '+report.exceptions.length+' exceptions; '+report.duplicates.length+' duplicate deliveries ignored.');
}
for(const id of ['expected','payments'])$(id).addEventListener('change',async()=>{
  clear();if(id==='expected')expected=null;else payments=null;
  try{const file=$(id).files[0];if(!file)return;if(file.size>5000000)throw Error('Maximum file size is 5 MB');
    const text=await file.text();
    if(id==='expected')expected=parseCsv(text);
    else{const d=JSON.parse(text);if(d.complete===false)throw Error('Truncated fetch: use a complete payment dataset');payments=Array.isArray(d)?d:d.payments;if(!Array.isArray(payments))throw Error('Expected payment array');}
    say('Loaded '+id+' data. Press Reconcile when both sources are ready.');
  }catch(e){say(e.message);}
});
$('demo').onclick=async()=>{clear();try{expected=parseCsv(await(await fetch('/examples/expected.csv')).text());payments=await(await fetch('/examples/payments.json')).json();render();say('Synthetic demo loaded: one paid, one partial, one unpaid, one unmatched payment and one duplicate delivery.');}catch(e){say(e.message);}};
$('run').onclick=()=>{try{if(!expected||!payments)throw Error('Load both expected and received payments first.');render();}catch(e){clear();say(e.message);}};
$('fetch').onclick=async()=>{
  clear();payments=null;$('fetch').disabled=true;say('Reading Horizon payment history…');
  try{const d=await fetchPayments($('account').value.trim(),{network:$('network').value});if(!d.complete)throw Error('History exceeds the 2,000-operation fetch limit. Use the CLI with cursors and an explicitly scoped dataset. No partial results loaded.');payments=d.payments;say('Loaded '+payments.length+' incoming classic payments from '+d.network+'. Excluded operations: '+JSON.stringify(d.ignored)+'. Soroban transfers are not included.');}
  catch(e){say(e.message);}finally{$('fetch').disabled=false;}
};
$('export').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([reportCsv(report)],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='stellar-reconciliation.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
