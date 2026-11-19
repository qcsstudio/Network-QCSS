'use client';
import {useState} from 'react';
import {Download,RefreshCw,ShieldCheck,Upload} from 'lucide-react';

type Snapshot={baselineSha256:string;advisory:{title:string;firstSeenAt:string;revisions:{version:number}[]};jobs:{id:string;channel:string;status:string;externalId:string|null;metadata?:unknown}[];aliases:unknown[];configuration:{canonical:string;manifestSha256:string;originConfigured:boolean;socialConfigured:boolean}};
type Channel='linkedin'|'facebook'|'instagram';
const asObject=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
function recoverReservations(snapshot:Snapshot){
 const result:Partial<Record<Channel,Record<string,unknown>>>={};
 for(const channel of ['linkedin','facebook','instagram'] as const){
  const matches=snapshot.jobs.filter(job=>job.channel===channel&&['publishing','needs_review'].includes(job.status));
  if(matches.length!==1)continue;
  const job=matches[0],release=asObject(asObject(job.metadata).reviewedLocalRelease),payload=asObject(release.destinationPayload);
  if(release.mode!=='server-controlled-native-handoff-v1'||release.manifestSha256!==snapshot.configuration.manifestSha256||typeof release.dispatchToken!=='string'||typeof release.payloadSha256!=='string'||typeof payload.caption!=='string'||typeof payload.mediaUrl!=='string')continue;
  result[channel]={jobId:job.id,channel,dispatchToken:release.dispatchToken,dispatchAt:release.dispatchStartedAt,caption:payload.caption,mediaUrl:payload.mediaUrl,payloadSha256:release.payloadSha256,status:job.status};
 }
 return result;
}
function FileField({label,onRead}:{label:string;onRead:(text:string)=>void}){return <label className="content-field"><span>{label}</span><input accept=".json,application/json" type="file" onChange={event=>{const file=event.target.files?.[0];if(file){if(file.size>250000){onRead('');return;}void file.text().then(onRead);}}}/></label>;}
function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function ReviewedAdvisoryControls({id,onClose}:{id:string;onClose:()=>void}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[candidateText,setCandidate]=useState(''),[reviewText,setReview]=useState(''),[activation,setActivation]=useState(''),[channel,setChannel]=useState<Channel>('linkedin'),[clearance,setClearance]=useState(''),[receipt,setReceipt]=useState(''),[reservations,setReservations]=useState<Partial<Record<Channel,Record<string,unknown>>>>({}),[backedUp,setBackedUp]=useState(false);
 const reservation=reservations[channel];
 const [confirmed,setConfirmed]=useState<Partial<Record<Channel,boolean>>>({});
 const endpoint=`/api/admin/security-advisories/${encodeURIComponent(id)}/reviewed-release`;
 async function call(body?:Record<string,unknown>){
  if(busy)return;setBusy(true);setMessage('');
  try{const response=await fetch(endpoint,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}:{cache:'no-store'});const result=await response.json();if(!response.ok||!result.ok)throw new Error(String(result.error||'The operation did not complete.'));
   if(!body){const current=result.snapshot as Snapshot;setSnapshot(current);setReservations(recoverReservations(current));setConfirmed(Object.fromEntries((['linkedin','facebook','instagram'] as const).map(c=>[c,current.jobs.some(job=>job.channel===c&&(job.status==='published'||Boolean(job.externalId)))])));setBackedUp(false);}else{setMessage(JSON.stringify(result.result));if(body.action==='reserve'){setReservations(previous=>({...previous,[channel]:result.result}));download(result.result,`qcs-${channel}-dispatch-reservation.json`);}if(body.action==='uncertain')setReservations(previous=>({...previous,[channel]:previous[channel]?{...previous[channel],status:'needs_review'}:undefined}));if(body.action==='receipt'){setReservations(previous=>({...previous,[channel]:undefined}));setConfirmed(previous=>({...previous,[channel]:true}));download({...result.result,channel,proof:body.proof},`qcs-${channel}-verified-receipt.json`);}}
   return result.result;
  }catch(error){setMessage(`${error instanceof Error?error.message:'Request interrupted.'} Verify the current server record and native history before repeating any write.`);}finally{setBusy(false);}
 }
 async function write(action:string){try{
  if(!snapshot)throw new Error('Load the current advisory and jobs first.');
  if(action==='apply')await call({action,candidateText,reviewText,expectedBaselineSha256:snapshot.baselineSha256,activation:JSON.parse(activation)});
  if(action==='reserve')await call({action,channel,manifestSha256:snapshot.configuration.manifestSha256,clearance:JSON.parse(clearance),activation:JSON.parse(activation)});
  if(action==='receipt'){const proof=asObject(JSON.parse(receipt));await call({action,channel,jobId:reservation?.jobId||proof.jobId,dispatchToken:reservation?.dispatchToken||proof.dispatchToken,proof});}
  if(action==='uncertain'&&reservation)await call({action,jobId:reservation.jobId,dispatchToken:reservation.dispatchToken});
 }catch(error){setMessage(error instanceof Error?error.message:'Invalid evidence file.');}}
 return <section className="content-editor" id="advisory-editor" aria-label="Reviewed Cisco advisory release">
  <div className="content-editor-heading"><div><p className="eyebrow">Single-advisory release</p><h3>Cisco Node.js advisory</h3></div><button className="button secondary" onClick={onClose} type="button">Close</button></div>
  <p>This control changes only the selected guide. Existing confirmed deliveries and native schedules are protected. No generic queue processing runs here.</p>
  <div className="content-action-row"><button className="button secondary" disabled={busy} onClick={()=>void call()} type="button"><RefreshCw size={17} aria-hidden="true"/> Load current record</button><button className="button secondary" disabled={busy||!snapshot} onClick={()=>{download(snapshot,`qcs-advisory-before-${Date.now()}.json`);setBackedUp(true);}} type="button"><Download size={17} aria-hidden="true"/> Download original backup</button></div>
  {snapshot?<><p><a href={snapshot.configuration.canonical} target="_blank" rel="noreferrer">Current public advisory</a> · Original publication: {snapshot.advisory.firstSeenAt} · Revision {snapshot.advisory.revisions[0]?.version}</p><div className="content-field-grid"><FileField label="Exact approved article bundle" onRead={setCandidate}/><FileField label="Exact independent review receipt" onRead={setReview}/><FileField label="Current deployment and writer-drain evidence" onRead={setActivation}/></div><p>Media staged: {snapshot.configuration.originConfigured?'yes':'no'} · Social pack reviewed: {snapshot.configuration.socialConfigured?'yes':'no'}</p><button className="button primary" type="button" disabled={busy||!backedUp||!candidateText||!reviewText||!activation||!snapshot.configuration.originConfigured} onClick={()=>void write('apply')}><Upload size={17} aria-hidden="true"/> Apply reviewed guide</button>
   <h4>Destination delivery</h4><ul>{snapshot.jobs.map(job=><li key={job.id}>{job.channel}: {job.status}{job.externalId?` | ${job.externalId}`:''}</li>)}</ul><label className="content-field"><span>Destination</span><select value={channel} disabled={busy} onChange={event=>{setChannel(event.target.value as Channel);setClearance('');setReceipt('');}}><option value="linkedin">Ravi K Sankhyan | LinkedIn</option><option value="facebook">QCS | Facebook</option><option value="instagram">@qcsstudio | Instagram</option></select></label><div className="content-field-grid"><FileField key={`clearance-${channel}`} label="Fresh native Published/Scheduled reconciliation" onRead={setClearance}/><FileField key={`receipt-${channel}`} label="Native receipt and evidence (after posting)" onRead={setReceipt}/></div><div className="content-action-row"><button className="button secondary" disabled={busy||!activation||!clearance||Boolean(reservation)||confirmed[channel]||!snapshot.configuration.socialConfigured} type="button" onClick={()=>void write('reserve')}><ShieldCheck size={17} aria-hidden="true"/> Reserve selected destination</button><button className="button secondary" disabled={busy||!receipt} type="button" onClick={()=>void write('receipt')}>Record verified receipt</button><button className="button secondary" disabled={busy||reservation?.status!=='publishing'} type="button" onClick={()=>void write('uncertain')}>Mark uncertain; do not retry</button></div>
   <ul aria-label="Retained destination reservations">{Object.entries(reservations).filter(([,value])=>value).map(([destination,value])=><li key={destination}>{destination}: {String(value?.status)}</li>)}</ul>
   {reservation?<><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:320,overflow:'auto'}}>{JSON.stringify(reservation,null,2)}</pre><button className="button secondary" disabled={busy} type="button" onClick={()=>download(reservation,`qcs-${channel}-dispatch-reservation.json`)}><Download size={17} aria-hidden="true"/> Download reservation</button></>:null}
  </>:null}
  <p role="status" style={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{busy?'Checking selected release...':message}</p>
 </section>;
}
