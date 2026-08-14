const platformButtons=[...document.querySelectorAll('.chip')];
platformButtons.forEach(button=>button.addEventListener('click',()=>{button.dataset.on=button.dataset.on==='true'?'false':'true'}));

const $=selector=>document.querySelector(selector);

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

function renderSnapshot(snapshot,dataMode){
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

$('#generate').addEventListener('click',()=>{
  renderSnapshot(createLocalDemo(),'LOCAL DEMO');
  $('#run').scrollIntoView({behavior:'smooth'});
});

async function loadLiveSnapshot(){
  try{
    const response=await fetch('./run-snapshot.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`snapshot unavailable: ${response.status}`);
    const snapshot=await response.json();
    if(snapshot?.schemaVersion!=='1'||!snapshot.projectId)throw new Error('invalid snapshot');
    renderSnapshot(snapshot,'LIVE SNAPSHOT');
  }catch{
    $('#dataMode').textContent='OFFLINE / DEMO';
  }
}

loadLiveSnapshot();
