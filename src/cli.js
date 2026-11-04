import {readFile,writeFile} from 'node:fs/promises';
import {reconcile,parseCsv,reportCsv} from './core.js';
import {fetchPayments} from './horizon.js';
const [command,...args]=process.argv.slice(2);
try{
  if(command==='demo'){
    const expected=parseCsv(await readFile(new URL('../examples/expected.csv',import.meta.url),'utf8'));
    const payments=JSON.parse(await readFile(new URL('../examples/payments.json',import.meta.url),'utf8'));
    console.log(JSON.stringify(reconcile(expected,payments),null,2));
  }else if(command==='reconcile'){
    const [expectedFile,paymentsFile,output]=args;
    if(!expectedFile||!paymentsFile)throw Error('Expected CSV and payment JSON paths required');
    const data=JSON.parse(await readFile(paymentsFile,'utf8'));
    if(data.complete===false)throw Error('Payment fetch was truncated. Fetch a larger window or reconcile an explicitly scoped complete dataset.');
    const report=reconcile(parseCsv(await readFile(expectedFile,'utf8')),Array.isArray(data)?data:data.payments);
    if(output)await writeFile(output,reportCsv(report));console.log(JSON.stringify(report,null,2));
  }else if(command==='fetch'){
    const [account,network='testnet',output='payments.json',cursor='']=args;
    const data=await fetchPayments(account,{network,cursor});
    await writeFile(output,JSON.stringify(data,null,2));console.log('Saved '+data.payments.length+' payments to '+output+'; complete='+data.complete);
  }else{console.log('Commands:\n  node src/cli.js demo\n  node src/cli.js reconcile expected.csv payments.json [report.csv]\n  node src/cli.js fetch G_ADDRESS [testnet|public] [payments.json] [cursor]');if(command)process.exitCode=1;}
}catch(e){console.error(e.message);process.exitCode=1;}
