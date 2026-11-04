import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const paths={'/':'web/index.html','/app.js':'web/app.js','/core.js':'src/core.js','/horizon.js':'src/horizon.js','/examples/expected.csv':'examples/expected.csv','/examples/payments.json':'examples/payments.json'};
const server=createServer(async(req,res)=>{
  const path=paths[new URL(req.url,'http://localhost').pathname];
  if(req.method!=='GET'||!path){res.writeHead(404);res.end('Not found');return;}
  try{const data=await readFile(new URL(path,import.meta.url));res.writeHead(200,{'Content-Type':path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.json')?'application/json':'text/csv','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(500);res.end('Could not read asset');}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Stellar Reconcile: http://127.0.0.1:'+server.address().port));
