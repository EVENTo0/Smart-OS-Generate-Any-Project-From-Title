import { createClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";

const url=globalThis.SMART_OS_SUPABASE_URL;
const key=globalThis.SMART_OS_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error("SMART OS Supabase public config unavailable");

const supabase=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const endpoint=`${url}/functions/v1/smart-os-approval`;
const $=selector=>document.querySelector(selector);
let requestView=null;
let safeCapability=false;

async function gateway(method,body){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw new Error("sign in required");
  const response=await fetch(endpoint,{
    method,
    headers:{
      "Content-Type":"application/json",
      apikey:key,
      Authorization:`Bearer ${session.access_token}`,
    },
    body:body?JSON.stringify(body):undefined,
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||`approval gateway error ${response.status}`);
  return payload;
}

function safeRequest(view){
  return view?.schemaVersion==="1"
    && typeof view.requestId==="string"
    && /^sha256:[0-9a-f]{64}$/.test(view.candidateFingerprint||"")
    && view.browserCanSelfApprove===false
    && view.containsVerifierCredential===false
    && view.containsOpaqueProof===false;
}

function hideActions(){
  const actions=$("#approvalActions");
  if(actions)actions.classList.add("hidden");
}

function renderRequest(view){
  if(!safeRequest(view))throw new Error("unsafe approval request projection");
  requestView=view;
  const status=$("#approvalRequestStatus");
  const meta=$("#approvalRequestMeta");
  const fingerprint=$("#approvalFingerprint");
  if(status){status.textContent="PENDING";status.classList.remove("good");status.classList.add("warn");}
  if(meta)meta.textContent=`${view.requestId} · ${(view.targetLanes||[]).join(", ")||"no targets"} · ${view.artifactCount||0} artifact(s) · expires ${view.expiresAt}`;
  if(fingerprint)fingerprint.textContent=view.candidateFingerprint;
  const actions=$("#approvalActions");
  if(actions&&safeCapability)actions.classList.remove("hidden");
}

async function refreshLiveApproval(){
  try{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){requestView=null;safeCapability=false;hideActions();return;}
    const capability=await gateway("GET");
    safeCapability=capability.authenticatedApproval===true
      && capability.oneTimeChallenge===true
      && capability.browserHasReleaseCredentials===false
      && capability.publicPublishAllowed===false;
    if(safeCapability&&safeRequest(capability.approvalRequest))renderRequest(capability.approvalRequest);
    else{requestView=null;hideActions();}
  }catch{
    requestView=null;
    safeCapability=false;
    hideActions();
  }
}

async function decide(decision){
  if(!requestView||!safeCapability)return;
  const approve=$("#approveRelease");
  const reject=$("#rejectRelease");
  if(approve)approve.disabled=true;
  if(reject)reject.disabled=true;
  try{
    const challenge=await gateway("POST",{
      action:"challenge",
      requestId:requestView.requestId,
      fingerprint:requestView.candidateFingerprint,
    });
    const result=await gateway("POST",{
      action:"decide",
      requestId:requestView.requestId,
      fingerprint:requestView.candidateFingerprint,
      challengeId:challenge.challengeId,
      decision,
    });
    const status=$("#approvalRequestStatus");
    const meta=$("#approvalRequestMeta");
    const approved=result.decision==="approve"&&result.publicPublishAuthorized===false;
    if(status){status.textContent=approved?"APPROVED":"REJECTED";status.classList.toggle("good",approved);status.classList.toggle("warn",!approved);}
    if(meta)meta.textContent=`Verified by ${result.verifierId} at ${result.decidedAt}. Public publish authorization: false.`;
    requestView=null;
    hideActions();
  }catch(error){
    const status=$("#approvalRequestStatus");
    const meta=$("#approvalRequestMeta");
    if(status){status.textContent="FAILED";status.classList.add("warn");}
    if(meta)meta.textContent=error instanceof Error?error.message:"Approval failed.";
    if(approve)approve.disabled=false;
    if(reject)reject.disabled=false;
  }
}

$("#approveRelease")?.addEventListener("click",()=>decide("approve"));
$("#rejectRelease")?.addEventListener("click",()=>decide("reject"));
$("#refresh")?.addEventListener("click",refreshLiveApproval);
supabase.auth.onAuthStateChange(()=>queueMicrotask(refreshLiveApproval));
queueMicrotask(refreshLiveApproval);
