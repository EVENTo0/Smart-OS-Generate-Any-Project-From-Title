const platformButtons=[...document.querySelectorAll('.chip')];
platformButtons.forEach(button=>button.addEventListener('click',()=>{button.dataset.on=button.dataset.on==='true'?'false':'true'}));

const $=selector=>document.querySelector(selector);
const SAFE_HISTORY_PATH=/^history\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.json$/;

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

function renderApprovalView(view){
  if(!isSafeApprovalView(view))throw new Error('invalid or unsafe approval view');
  $('#approvalRequestStatus').textContent='PENDING';
  $('#approvalRequestStatus').classList.add('warn');
  $('#approvalRequestMeta').textContent=`${view.requestId} · ${(view.targetLanes||[]).join(', ')||'no targets'} · ${view.artifactCount||0} artifact(s) · expires ${view.expiresAt}`;
  $('#approvalFingerprint').textContent=view.candidateFingerprint;
}

function clearApprovalView(){
  $('#approvalRequestStatus').textContent='NONE';
  $('#approvalRequestStatus').classList.remove('warn','good');
  $('#approvalRequestMeta').textContent='No verified approval request has been materialized.';
  $('#approvalFingerprint').textContent='';
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

async function refreshControlData(){
  const button=$('#refresh');
  button.disabled=true;
  button.textContent='Refreshing…';
  try{
    await Promise.all([loadLiveSnapshot(),loadHistory(),loadApprovalRequest()]);
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
refreshControlData();
