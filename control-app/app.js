import { createClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";
import { SMART_OS_SUPABASE_URL, SMART_OS_SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase=createClient(SMART_OS_SUPABASE_URL,SMART_OS_SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
});
const APPROVAL_ENDPOINT=`${SMART_OS_SUPABASE_URL}/functions/v1/smart-os-approval`;

const platformButtons=[...document.querySelectorAll('.chip')];
platformButtons.forEach(button=>button.addEventListener('click',()=>{button.dataset.on=button.dataset.on==='true'?'false':'true'}));

const $=selector=>document.querySelector(selector);
const SAFE_HISTORY_PATH=/^history\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.json$/;
let currentApprovalView=null;
let approvalCapability=false;
let authRefreshQueued=false;

function statusStep(label,value){
  const row=document.createElement('div');
  row.className='step';
  const name=document.createElement('span');
  name.textContent=label;
  const status=document.createElement('span');
  status.className='status';
  status.textContent=value;
  row.append(name,status);
  return row;
}

function renderAttempts(attempts=[]){
  const root=$('#attempts');
  root.replaceChildren();
  if(!attempts.length){root.textContent='No attempts yet.';return;}
  attempts.forEach(item=>{
    const row=document.createElement('div');
    row.className='attempt';
    const blocker=item.blockerKind?` · ${item.blockerKind}`:'';
    row.textContent=`#${item.attempt} · ${item.runnerId} · ${item.outcome}${blocker}`;
    root.append(row);
  });
}

function isValidSnapshot(snapshot){
  return snapshot?.schemaVersion==='1'
    && typeof snapshot.projectId==='string'
    && snapshot.projectId.length>0
    && snapshot.policy?.exposesSecrets===false
    && snapshot.policy?.exposesRawLogs===false
    && snapshot.policy?.allowsPublicPublish===false;
}

function isSafeApprovalView(view){
  return view?.schemaVersion==='1'
    && typeof view.requestId==='string'
    && /^sha256:[a-f0-9]{64}$/i.test(view.candidateFingerprint||'')
    && view.browserCanSelfApprove===false
    && view.containsVerifierCredential===false
    && view.containsOpaqueProof===false;
}

function updateApprovalActionVisibility(){
  const visible=Boolean(currentApprovalView&&approvalCapability);
  $('#approvalActions').classList.toggle('hidden',!visible);
}

function renderApprovalView(view){
  if(!isSafeApprovalView(view))throw new Error('invalid or unsafe approval view');
  currentApprovalView=view;
  $('#approvalRequestStatus').textContent='PENDING';
  $('#approvalRequestStatus').classList.remove('good');
  $('#approvalRequestStatus').classList.add('warn');
  $('#approvalRequestMeta').textContent=`${view.requestId} · ${(view.targetLanes||[]).join(', ')||'no targets'} · ${view.artifactCount||0} artifact(s) · expires ${view.expiresAt}`;
  $('#approvalFingerprint').textContent=view.candidateFingerprint;
  updateApprovalActionVisibility();
}

function clearApprovalView(){
  currentApprovalView=null;
  $('#approvalRequestStatus').textContent='NONE';
  $('#approvalRequestStatus').classList.remove('warn','good');
  $('#approvalRequestMeta').textContent='No verified approval request has been materialized.';
  $('#approvalFingerprint').textContent='';
  updateApprovalActionVisibility();
}

function renderSnapshot(snapshot,dataMode){
  if(!isValidSnapshot(snapshot))throw new Error('invalid or unsafe snapshot');
  $('#dataMode').textContent=dataMode;
  $('#runTitle').textContent=snapshot.title||snapshot.projectId||'SMART OS run';
  $('#runStatus').textContent=snapshot.lifecycleState||'DRAFT_IDEA';
  $('#runMeta').textContent=`${(snapshot.targetLanes||[]).join(', ')||'no targets'} · safe mobile projection`;

  const release=snapshot.release||{};
  const execution=snapshot.execution||{};
  $('#readiness').textContent=`${Number.isFinite(release.score)?release.score:0}%`;
  $('#approvalState').textContent=release.approvedByHuman?'Human approval recorded':release.humanApprovalRequired===false?'No approval required':'Human approval required';
  $('#runner').textContent=execution.successfulRunnerId||execution.activeRunnerId||'—';
  $('#runnerStatus').textContent=execution.status||'not-started';
  renderAttempts(execution.attempts||[]);

  const steps=$('#steps');
  steps.replaceChildren(
    statusStep('Lifecycle',snapshot.lifecycleState||'DRAFT_IDEA'),
    statusStep('Execution',execution.status||'not-started'),
    statusStep('Artifacts',String((snapshot.artifacts||[]).length)),
    statusStep('Technical readiness',release.technicalReady?'READY':'NOT READY'),
    statusStep('Release candidate',release.candidateStatus||'not-evaluated'),
  );

  $('#dna').textContent='The phone snapshot intentionally excludes raw evidence, raw logs and secrets. Full Project DNA remains in the isolated project workspace.';
  $('#artifacts').textContent=(snapshot.artifacts||[]).length
    ? snapshot.artifacts.map(item=>`${item.kind} · ${item.producedBy}`).join(' | ')
    : 'None yet.';

  const blockers=release.blockers||[];
  $('#blockers').textContent=blockers.length?blockers.join(' · '):'No active release blockers.';
  const ready=release.candidateStatus==='ready';
  $('#releaseLock').textContent=ready?'READY':'LOCKED';
  $('#releaseLock').classList.toggle('good',ready);
  $('#releaseLock').classList.toggle('warn',!ready);
  $('#run').classList.remove('hidden');
}

function createLocalDemo(){
  const title=$('#title').value.trim()||'Untitled project';
  const platforms=platformButtons.filter(button=>button.dataset.on==='true').map(button=>button.dataset.value);
  return {
    schemaVersion:'1',
    projectId:title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'untitled-project',
    title,
    lifecycleState:'DRAFT_IDEA',
    targetLanes:platforms,
    execution:{status:'not-started',attempts:[]},
    release:{score:0,technicalReady:false,candidateStatus:'not-evaluated',humanApprovalRequired:true,approvedByHuman:false,blockers:['local demo only — no live runner evidence']},
    artifacts:[],
    infrastructure:{activeBlockers:[],historicalBlockers:[]},
    policy:{exposesSecrets:false,exposesRawLogs:false,allowsPublicPublish:false},
  };
}

async function fetchJson(path){
  const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw new Error(`request unavailable: ${response.status}`);
  return response.json();
}

async function loadSnapshotPath(path,dataMode='HISTORY SNAPSHOT'){
  if(path!=='./run-snapshot.json'&&!SAFE_HISTORY_PATH.test(path.replace(/^\.\//,''))){
    throw new Error('unsafe snapshot path');
  }
  const snapshot=await fetchJson(path);
  renderSnapshot(snapshot,dataMode);
  return snapshot;
}

function renderHistory(entries=[]){
  const root=$('#history');
  root.replaceChildren();
  if(!entries.length){root.textContent='No persisted run history available.';return;}

  entries.slice(0,20).forEach(entry=>{
    if(!entry||!SAFE_HISTORY_PATH.test(entry.historyPath||''))return;
    const row=document.createElement('div');
    row.className='history-item';
    const button=document.createElement('button');
    button.className='secondary';
    button.type='button';
    button.textContent=`${entry.title||entry.projectId} · ${entry.lifecycleState||'unknown'} · ${Number.isFinite(entry.releaseScore)?entry.releaseScore:0}% · ${entry.candidateStatus||'unknown'}`;
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{
        await loadSnapshotPath(`./${entry.historyPath}`,'HISTORY SNAPSHOT');
        $('#run').scrollIntoView({behavior:'smooth'});
      }catch{
        $('#dataMode').textContent='HISTORY UNAVAILABLE';
      }finally{
        button.disabled=false;
      }
    });
    row.append(button);
    root.append(row);
  });

  if(!root.children.length)root.textContent='No valid history entries available.';
}

async function loadHistory(){
  try{
    const entries=await fetchJson('./history/index.json');
    renderHistory(Array.isArray(entries)?entries:[]);
  }catch{
    renderHistory([]);
  }
}

async function loadApprovalRequest(){
  try{
    const view=await fetchJson('./approval-request.json');
    renderApprovalView(view);
  }catch{
    clearApprovalView();
  }
}

async function loadLiveSnapshot(){
  try{
    await loadSnapshotPath('./run-snapshot.json','LIVE SNAPSHOT');
    return true;
  }catch{
    $('#dataMode').textContent='OFFLINE / DEMO';
    return false;
  }
}

async function gatewayFetch(method,body){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw new Error('sign in required');
  const response=await fetch(APPROVAL_ENDPOINT,{
    method,
    headers:{
      'Content-Type':'application/json',
      'apikey':SMART_OS_SUPABASE_PUBLISHABLE_KEY,
      'Authorization':`Bearer ${session.access_token}`,
    },
    body:body?JSON.stringify(body):undefined,
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||`approval gateway error ${response.status}`);
  return payload;
}

async function verifyApprovalCapability(){
  approvalCapability=false;
  $('#approvalCapability').textContent='Authenticated approval capability unavailable until sign-in.';
  try{
    const capability=await gatewayFetch('GET');
    approvalCapability=capability.authenticatedApproval===true&&capability.publicPublishAllowed===false;
    $('#approvalCapability').textContent=approvalCapability
      ?'Authenticated one-time approval gateway verified. Public publishing remains separately locked.'
      :'Approval gateway did not advertise the required safe capability.';
  }catch(error){
    $('#approvalCapability').textContent=error instanceof Error?error.message:'Approval gateway unavailable.';
  }
  updateApprovalActionVisibility();
}

async function refreshAuthUi(){
  const {data:{session}}=await supabase.auth.getSession();
  const signedIn=Boolean(session?.user);
  $('#authStatus').textContent=signedIn?'SIGNED IN':'SIGNED OUT';
  $('#authStatus').classList.toggle('good',signedIn);
  $('#authForm').classList.toggle('hidden',signedIn);
  $('#signOut').classList.toggle('hidden',!signedIn);
  $('#authMessage').textContent=signedIn
    ?`Authenticated as ${session.user.email||session.user.id}. Approval still requires an exact scoped request.`
    :'Sign in to the isolated SMART OS Supabase project before approving a release candidate.';
  if(signedIn)await verifyApprovalCapability();
  else{
    approvalCapability=false;
    $('#approvalCapability').textContent='Authenticated approval capability unavailable until sign-in.';
    updateApprovalActionVisibility();
  }
}

function scheduleAuthRefresh(){
  if(authRefreshQueued)return;
  authRefreshQueued=true;
  queueMicrotask(async()=>{
    authRefreshQueued=false;
    await refreshAuthUi();
  });
}

async function signIn(){
  const email=$('#authEmail').value.trim();
  const password=$('#authPassword').value;
  if(!email||password.length<8){$('#authMessage').textContent='Enter a valid email and a password of at least 8 characters.';return;}
  $('#authMessage').textContent='Signing in…';
  const {error}=await supabase.auth.signInWithPassword({email,password});
  if(error){$('#authMessage').textContent=error.message;return;}
  $('#authPassword').value='';
  await refreshAuthUi();
}

async function signUp(){
  const email=$('#authEmail').value.trim();
  const password=$('#authPassword').value;
  if(!email||password.length<8){$('#authMessage').textContent='Enter a valid email and a password of at least 8 characters.';return;}
  $('#authMessage').textContent='Creating account…';
  const {data,error}=await supabase.auth.signUp({email,password});
  if(error){$('#authMessage').textContent=error.message;return;}
  $('#authPassword').value='';
  if(data.session)await refreshAuthUi();
  else $('#authMessage').textContent='Account created. Complete email confirmation if Supabase requires it, then sign in.';
}

async function submitApprovalDecision(decision){
  if(!currentApprovalView||!approvalCapability)return;
  const approveButton=$('#approveRelease');
  const rejectButton=$('#rejectRelease');
  approveButton.disabled=true;
  rejectButton.disabled=true;
  $('#approvalRequestStatus').textContent='VERIFYING';
  try{
    const challenge=await gatewayFetch('POST',{
      action:'challenge',
      requestId:currentApprovalView.requestId,
      fingerprint:currentApprovalView.candidateFingerprint,
    });
    const result=await gatewayFetch('POST',{
      action:'decide',
      requestId:currentApprovalView.requestId,
      fingerprint:currentApprovalView.candidateFingerprint,
      challengeId:challenge.challengeId,
      decision,
    });
    const approved=result.decision==='approve'&&result.publicPublishAuthorized===false;
    $('#approvalRequestStatus').textContent=approved?'APPROVED':'REJECTED';
    $('#approvalRequestStatus').classList.toggle('good',approved);
    $('#approvalRequestStatus').classList.toggle('warn',!approved);
    $('#approvalRequestMeta').textContent=`Verified by ${result.verifierId} at ${result.decidedAt}. Public publish authorization: false.`;
    $('#approvalActions').classList.add('hidden');
  }catch(error){
    $('#approvalRequestStatus').textContent='FAILED';
    $('#approvalRequestStatus').classList.add('warn');
    $('#approvalRequestMeta').textContent=error instanceof Error?error.message:'Approval failed.';
    approveButton.disabled=false;
    rejectButton.disabled=false;
  }
}

async function refreshControlData(){
  const button=$('#refresh');
  button.disabled=true;
  button.textContent='Refreshing…';
  try{
    await Promise.all([loadLiveSnapshot(),loadHistory(),loadApprovalRequest(),refreshAuthUi()]);
  }finally{
    button.disabled=false;
    button.textContent='Refresh Live Snapshot';
  }
}

$('#generate').addEventListener('click',()=>{
  clearApprovalView();
  renderSnapshot(createLocalDemo(),'LOCAL DEMO');
  $('#run').scrollIntoView({behavior:'smooth'});
});
$('#refresh').addEventListener('click',refreshControlData);
$('#signIn').addEventListener('click',signIn);
$('#signUp').addEventListener('click',signUp);
$('#signOut').addEventListener('click',async()=>{await supabase.auth.signOut();await refreshAuthUi();});
$('#approveRelease').addEventListener('click',()=>submitApprovalDecision('approve'));
$('#rejectRelease').addEventListener('click',()=>submitApprovalDecision('reject'));
supabase.auth.onAuthStateChange(scheduleAuthRefresh);
refreshControlData();
