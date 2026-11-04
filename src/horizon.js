const networks={testnet:'https://horizon-testnet.stellar.org',public:'https://horizon.stellar.org'};
/** Classic payments and path payments only. Soroban transfers require an indexer. */
export async function fetchPayments(account,{network='testnet',cursor='',maxPages=10,fetcher=fetch}={}){
  if(!/^G[A-Z2-7]{55}$/.test(account))throw Error('Use a classic Stellar G-address (format checked; checksum not validated)');
  if(!networks[network])throw Error('Unknown network');
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>100)throw Error('maxPages must be 1..100');
  const base=networks[network],records=[],ignored={},txs=new Map();let nextCursor=cursor,complete=false;
  const get=async url=>{const r=await fetcher(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Horizon HTTP '+r.status);return r.json();};
  for(let page=0;page<maxPages;page++){
    const url=new URL('/accounts/'+account+'/payments',base);
    url.search=new URLSearchParams({order:'asc',limit:'200',cursor:nextCursor,include_failed:'false'});
    const data=await get(url);
    if(!Array.isArray(data?._embedded?.records))throw Error('Malformed Horizon collection');
    const batch=data._embedded.records;
    if(!batch.length){complete=true;break;}
    for(const p of batch){
      if(!p.paging_token)throw Error('Missing Horizon paging token');
      nextCursor=p.paging_token;
      if(!['payment','path_payment_strict_receive','path_payment_strict_send'].includes(p.type)||p.to!==account){ignored[p.type]=(ignored[p.type]||0)+1;continue;}
      if(!/^[a-f0-9]{64}$/.test(p.transaction_hash))throw Error('Invalid transaction hash');
      if(!txs.has(p.transaction_hash))txs.set(p.transaction_hash,await get(base+'/transactions/'+p.transaction_hash));
      const tx=txs.get(p.transaction_hash);
      // Preserve muxed destination IDs: these cannot be silently treated as bare G-address payments.
      records.push({id:String(p.id),destination:p.to_muxed||p.to,asset:p.asset_type==='native'?'XLM':p.asset_code+':'+p.asset_issuer,amount:p.amount,memoType:tx.memo_type||'none',memo:tx.memo??'',successful:p.transaction_successful===true&&tx.successful===true,transactionHash:p.transaction_hash,createdAt:p.created_at});
    }
    if(batch.length<200){complete=true;break;}
  }
  return {network,account,payments:records,nextCursor,complete,ignored,note:'Classic payment history only; excluded operations and Soroban transfers are not reconciled.'};
}
