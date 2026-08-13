const pipeline=["Intake","Research & Evidence","Questionnaire","Project DNA","Capability Broker","Implementation","Build & Test","Runtime Verification","Release Readiness"];
const platformButtons=[...document.querySelectorAll('.chip')];
platformButtons.forEach(button=>button.addEventListener('click',()=>{button.dataset.on=button.dataset.on==='true'?'false':'true'}));

document.querySelector('#generate').addEventListener('click',()=>{
  const title=document.querySelector('#title').value.trim()||'Untitled project';
  const mode=document.querySelector('#mode').value;
  const autonomy=document.querySelector('#autonomy').value;
  const platforms=platformButtons.filter(button=>button.dataset.on==='true').map(button=>button.dataset.value);
  document.querySelector('#runTitle').textContent=title;
  document.querySelector('#runStatus').textContent='BLUEPRINT_READY';
  document.querySelector('#runMeta').textContent=`${mode} · ${autonomy} · ${platforms.join(', ')||'no platform selected'}`;
  document.querySelector('#dna').textContent=`Original project workspace with ${platforms.length} target platform${platforms.length===1?'':'s'}; evidence, user decisions and AI defaults remain separated.`;
  document.querySelector('#steps').innerHTML=pipeline.map((name,index)=>`<div class="step"><span>${index+1}. ${name}</span><span class="status">${index<5?'READY':'PLANNED'}</span></div>`).join('');
  document.querySelector('#run').classList.remove('hidden');
  document.querySelector('#run').scrollIntoView({behavior:'smooth'});
});
