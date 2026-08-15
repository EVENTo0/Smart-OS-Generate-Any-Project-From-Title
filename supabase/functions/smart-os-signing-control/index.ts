import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
function extractKey(raw:string|undefined,prefixes:string[]):string|null{if(!raw)return null;if(prefixes.some(p=>raw.startsWith(p))||raw.split(".").length===3)return raw;try{const x=JSON.parse(raw);const walk=(v:unknown):string|null=>{if(typeof v==="string"&&(prefixes.some(p=>v.startsWith(p))||v.split(".").length===3))return v;if(Array.isArray(v))for(const i of v){const f=walk(i);if(f)return f;}if(v&&typeof v==="object")for(const i of Object.values(v as Record<string,unknown>)){const f=walk(i);if(f)return f;}return null;};return walk(x);}catch{return null;}}
const PUBLISHABLE_KEY=extractKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"),["sb_publishable_"])??extractKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),["sb_publishable_"])??extractKey(Deno.env.get("SUPABASE_ANON_KEY"),["eyJ"])??"";
const SERVICE_KEY=extractKey(Deno.env.get("SUPABASE_SECRET_KEYS"),["sb_secret_"])??extractKey(Deno.env.get("SUPABASE_SECRET_KEY"),["sb_secret_"])??extractKey(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),["eyJ"])??"";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
function json(status:number,body:unknown){return new Response(JSON.stringify(body),{status,headers:cors});}
function svc(){const h:Record<string,string>={apikey:SERVICE_KEY,"Content-Type":"application/json"};if(SERVICE_KEY.split(".").length===3)h.Authorization=`Bearer ${SERVICE_KEY}`;return h;}
async function rest(path:string){return fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:svc()});}
async function getUser(req:Request){const auth=req.headers.get("authorization")??"";if(!auth.toLowerCase().startsWith("bearer ")||!PUBLISHABLE_KEY)return null;const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:PUBLISHABLE_KEY,Authorization:auth}});if(!r.ok)return null;const d=await r.json();return d?.id?{id:d.id}:null;}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(!SUPABASE_URL||!PUBLISHABLE_KEY||!SERVICE_KEY)return json(503,{error:"signing control environment incomplete"});
 const user=await getUser(req);if(!user)return json(401,{error:"authenticated SMART OS user required"});
 const rcq=new URLSearchParams({approved_by:`eq.${user.id}`,status:"eq.promoted",public_publish_authorized:"eq.false",select:"release_candidate_id,project_id,version,candidate_fingerprint,target_lanes,promoted_at,status,public_publish_authorized",order:"promoted_at.desc",limit:"20"});
 const rcr=await rest(`smart_os_release_candidates?${rcq}`);if(!rcr.ok)return json(500,{error:"release candidate status lookup failed"});
 const candidates=await rcr.json();
 const jq=new URLSearchParams({created_by:`eq.${user.id}`,select:"job_id,release_candidate_id,project_id,version,lane,runner_id,status,created_at,leased_at,completed_at,artifact_sha256,artifact_size_bytes,result_summary,public_publish_authorized,store_upload_authorized",order:"created_at.desc",limit:"30"});
 const jr=await rest(`smart_os_signing_jobs?${jq}`);if(!jr.ok)return json(500,{error:"signing job status lookup failed"});
 const jobs=await jr.json();
 return json(200,{candidates,jobs,commandsIncluded:false,secretRefsIncluded:false,secretValuesIncluded:false,publicPublishAuthorized:false,storeUploadAuthorized:false});
});
