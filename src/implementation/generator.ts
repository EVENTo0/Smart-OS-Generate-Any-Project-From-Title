import type { ImplementationBundle, ImplementationRequest } from "./types";

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function snakeSource(): string {
  return `const canvas=document.querySelector('#game');
const ctx=canvas.getContext('2d');
const cell=20, cols=Math.floor(canvas.width/cell), rows=Math.floor(canvas.height/cell);
let snake,dir,food,score,timer;
function placeFood(){
  do { food={x:Math.floor(Math.random()*cols),y:Math.floor(Math.random()*rows)}; }
  while(snake.some(p=>p.x===food.x&&p.y===food.y));
}
function reset(){
  snake=[{x:8,y:12},{x:7,y:12},{x:6,y:12}]; dir={x:1,y:0}; score=0; placeFood();
  clearInterval(timer); timer=setInterval(step,110); draw();
}
function step(){
  const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  const hitWall=head.x<0||head.y<0||head.x>=cols||head.y>=rows;
  const hitSelf=snake.some(p=>p.x===head.x&&p.y===head.y);
  if(hitWall||hitSelf){ clearInterval(timer); draw(true); return; }
  snake.unshift(head);
  if(head.x===food.x&&head.y===food.y){ score++; placeFood(); } else snake.pop();
  draw();
}
function draw(gameOver=false){
  ctx.fillStyle='#0b0d10'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#f2f2f2'; ctx.font='16px sans-serif'; ctx.fillText('Score: '+score,12,22);
  ctx.fillStyle='#7ee787'; snake.forEach(p=>ctx.fillRect(p.x*cell+1,p.y*cell+1,cell-2,cell-2));
  ctx.fillStyle='#ff7b72'; ctx.fillRect(food.x*cell+2,food.y*cell+2,cell-4,cell-4);
  if(gameOver){ ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#fff'; ctx.font='22px sans-serif'; ctx.fillText('Game Over',112,285); ctx.font='16px sans-serif'; ctx.fillText('Tap or press Enter to restart',70,318); }
}
function setDir(x,y){ if(dir.x===-x&&dir.y===-y)return; dir={x,y}; }
addEventListener('keydown',e=>{
  if(e.key==='ArrowUp')setDir(0,-1); if(e.key==='ArrowDown')setDir(0,1); if(e.key==='ArrowLeft')setDir(-1,0); if(e.key==='ArrowRight')setDir(1,0); if(e.key==='Enter')reset();
});
let start=null;
canvas.addEventListener('pointerdown',e=>{ start={x:e.clientX,y:e.clientY}; if(!timer) reset(); });
canvas.addEventListener('pointerup',e=>{ if(!start)return; const dx=e.clientX-start.x,dy=e.clientY-start.y; if(Math.abs(dx)>Math.abs(dy))setDir(Math.sign(dx),0); else setDir(0,Math.sign(dy)); start=null; });
reset();
`;
}

function universalProductFiles(request: ImplementationRequest) {
  const title = htmlEscape(request.title);
  const project = JSON.stringify(request.title);
  const manifest = {
    name: request.title,
    short_name: request.title.slice(0, 24),
    start_url: "./",
    display: "standalone",
    background_color: "#071018",
    theme_color: "#0d1b2a",
    icons: [],
  };

  const index = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0d1b2a">
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="stylesheet" href="./styles.css">
  <title>${title}</title>
</head>
<body data-preview="website">
  <div class="topbar">
    <div class="brand"><span class="mark">N</span><span>${title}</span></div>
    <div class="preview-switch" aria-label="Preview mode">
      <button data-preview-button="website" class="active">Website</button>
      <button data-preview-button="app">App</button>
    </div>
  </div>

  <main class="experience">
    <section class="hero">
      <div class="eyebrow">SMART OS · LIVE GENERATED PROJECT</div>
      <h1>Services, bookings and customer requests in one experience.</h1>
      <p>Responsive website and mobile-first application shell generated from a project title and platform targets.</p>
      <div class="hero-actions">
        <button class="primary" data-scroll-request>Request a service</button>
        <button class="ghost" data-select-service="Consultation">Book consultation</button>
      </div>
      <div class="metrics">
        <div><strong>24/7</strong><span>Request intake</span></div>
        <div><strong>&lt; 1 min</strong><span>Smart quote flow</span></div>
        <div><strong>Web + App</strong><span>One product system</span></div>
      </div>
    </section>

    <section class="section" id="services">
      <div class="section-head"><div><div class="eyebrow">POPULAR SERVICES</div><h2>Choose what you need</h2></div><span class="pill">Live prototype</span></div>
      <div class="service-grid">
        <article class="service"><div class="icon">01</div><h3>Consultation</h3><p>Define scope, goals and the fastest delivery route.</p><button data-select-service="Consultation">Select</button></article>
        <article class="service"><div class="icon">02</div><h3>Design</h3><p>Product, interface and customer experience design.</p><button data-select-service="Design">Select</button></article>
        <article class="service"><div class="icon">03</div><h3>Build</h3><p>Website and mobile application implementation.</p><button data-select-service="Build">Select</button></article>
        <article class="service"><div class="icon">04</div><h3>Support</h3><p>Post-delivery improvements, updates and assistance.</p><button data-select-service="Support">Select</button></article>
      </div>
    </section>

    <section class="section request-card" id="request">
      <div><div class="eyebrow">SMART REQUEST</div><h2>Start your request</h2><p>Demo submission stays on this device and does not create a production order.</p></div>
      <form id="requestForm">
        <label>Name<input id="customerName" required placeholder="Your name"></label>
        <label>Service<select id="serviceSelect"><option>Consultation</option><option>Design</option><option>Build</option><option>Support</option></select></label>
        <label>Preferred date<input id="preferredDate" type="date"></label>
        <label>What do you need?<textarea id="requestNote" rows="3" placeholder="Describe the website or app you want..."></textarea></label>
        <button class="primary" type="submit">Create demo request</button>
      </form>
      <div id="requestResult" class="result hidden" role="status"></div>
    </section>

    <section class="section app-only app-dashboard">
      <div class="section-head"><div><div class="eyebrow">APP HOME</div><h2>Your project dashboard</h2></div><span class="avatar">MO</span></div>
      <div class="app-cards">
        <button><span>Active request</span><strong>Design + Build</strong><small>Scope review · today</small></button>
        <button><span>Next action</span><strong>Approve estimate</strong><small>Demo workflow</small></button>
      </div>
    </section>
  </main>

  <nav class="app-nav app-only" aria-label="App navigation">
    <button class="active">Home</button><button>Services</button><button>Requests</button><button>Profile</button>
  </nav>

  <div id="toast" class="toast hidden"></div>
  <script>window.__SMART_OS_PROJECT__=${project};</script>
  <script type="module" src="./app.js"></script>
</body>
</html>\n`;

  const styles = `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#ecf4ff;background:#061019;color-scheme:dark;--panel:#0c1824;--panel2:#101f2f;--line:#21384e;--muted:#8da3b8;--accent:#70b7ff}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:radial-gradient(circle at 80% 0,#173454 0,transparent 35%),linear-gradient(180deg,#07121c,#050a0f 72%)}button,input,select,textarea{font:inherit}.topbar{height:76px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 max(20px,calc((100vw - 1180px)/2));position:sticky;top:0;background:rgba(6,16,25,.82);backdrop-filter:blur(16px);z-index:20;border-bottom:1px solid rgba(112,183,255,.12)}.brand{display:flex;align-items:center;gap:10px;font-weight:800}.mark{width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,#78c5ff,#735dff);display:grid;place-items:center}.preview-switch{display:flex;padding:4px;background:#0a1621;border:1px solid #20364a;border-radius:14px}.preview-switch button{border:0;background:transparent;color:#8fa4b8;padding:9px 13px;border-radius:10px}.preview-switch .active{background:#19324b;color:white}.experience{max-width:1180px;margin:auto;padding:36px 20px 100px;transition:max-width .3s ease}.hero{padding:72px 0 50px}.eyebrow{font-size:12px;letter-spacing:.16em;color:#7cbfff;font-weight:800}.hero h1{max-width:790px;font-size:clamp(42px,7vw,78px);line-height:.96;margin:18px 0}.hero p{max-width:680px;font-size:20px;line-height:1.6;color:var(--muted)}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin:30px 0}.primary,.ghost,.service button{border-radius:14px;border:1px solid #3478b9;padding:13px 18px;font-weight:800;color:white;background:linear-gradient(135deg,#1768ad,#4357d9);cursor:pointer}.ghost,.service button{background:#0e1c29;border-color:#29455f}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:48px}.metrics div,.service,.request-card,.app-cards button{border:1px solid var(--line);background:linear-gradient(180deg,rgba(17,34,50,.9),rgba(8,19,29,.95));border-radius:20px;padding:20px}.metrics strong{display:block;font-size:24px}.metrics span,.service p,.request-card p,small{color:var(--muted)}.section{padding:46px 0}.section h2{font-size:34px;margin:8px 0}.section-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.pill{border:1px solid #2f6c9e;color:#a7d7ff;border-radius:999px;padding:7px 11px;font-size:12px}.service-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px}.service{min-height:240px;display:flex;flex-direction:column}.service .icon{width:46px;height:46px;border-radius:15px;border:1px solid #315879;display:grid;place-items:center;color:#79c0ff}.service h3{font-size:21px;margin:22px 0 4px}.service p{line-height:1.5;flex:1}.service button{width:100%}.request-card{display:grid;grid-template-columns:.8fr 1.2fr;gap:34px;padding:30px}.request-card form{display:grid;gap:12px}.request-card label{font-size:12px;color:#9fb1c3}.request-card input,.request-card select,.request-card textarea{display:block;width:100%;margin-top:6px;border:1px solid #29445d;background:#07131e;color:#fff;border-radius:12px;padding:12px}.result{margin-top:16px;padding:15px;border-radius:13px;background:#0c362b;border:1px solid #227058}.hidden{display:none!important}.app-only{display:none}.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);padding:12px 16px;border-radius:12px;background:#e8f4ff;color:#07131e;font-weight:800;z-index:50;box-shadow:0 12px 40px #0008}
body[data-preview="app"] .experience{max-width:430px;padding:18px 14px 110px}body[data-preview="app"] .topbar{padding:0 14px}body[data-preview="app"] .brand span:last-child{display:none}body[data-preview="app"] .hero{padding:34px 0 22px}body[data-preview="app"] .hero h1{font-size:42px}body[data-preview="app"] .hero p{font-size:16px}body[data-preview="app"] .metrics{grid-template-columns:1fr}body[data-preview="app"] .service-grid{grid-template-columns:1fr 1fr}body[data-preview="app"] .service{min-height:210px}body[data-preview="app"] .request-card{grid-template-columns:1fr;padding:18px}body[data-preview="app"] .app-only{display:block}body[data-preview="app"] .app-dashboard{padding-bottom:16px}.app-cards{display:grid;gap:10px}.app-cards button{text-align:left;color:white}.app-cards span,.app-cards strong,.app-cards small{display:block}.app-cards strong{font-size:18px;margin:5px 0}.avatar{width:42px;height:42px;border-radius:50%;background:#294e72;display:grid;place-items:center}.app-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(430px,100%);background:rgba(6,15,23,.96);border-top:1px solid #25415a;padding:10px 8px calc(10px + env(safe-area-inset-bottom));z-index:30}.app-nav button{width:25%;border:0;background:transparent;color:#839aae;padding:10px 3px}.app-nav .active{color:#7fc5ff}@media(max-width:800px){.service-grid{grid-template-columns:1fr 1fr}.request-card{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}}@media(max-width:480px){.hero h1{font-size:43px}.service-grid{grid-template-columns:1fr}.preview-switch button{padding:8px 10px}}\n`;

  const app = `const body=document.body;
const buttons=[...document.querySelectorAll('[data-preview-button]')];
const select=document.querySelector('#serviceSelect');
const requestSection=document.querySelector('#request');
const toast=document.querySelector('#toast');
function showToast(message){toast.textContent=message;toast.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),2200)}
function setPreview(mode){body.dataset.preview=mode;buttons.forEach(b=>b.classList.toggle('active',b.dataset.previewButton===mode));showToast(mode==='app'?'Mobile app preview active':'Website preview active')}
buttons.forEach(button=>button.addEventListener('click',()=>setPreview(button.dataset.previewButton)));
document.querySelectorAll('[data-select-service]').forEach(button=>button.addEventListener('click',()=>{select.value=button.dataset.selectService;requestSection.scrollIntoView({behavior:'smooth'});showToast(button.dataset.selectService+' selected')}));
document.querySelector('[data-scroll-request]').addEventListener('click',()=>requestSection.scrollIntoView({behavior:'smooth'}));
document.querySelector('#requestForm').addEventListener('submit',event=>{event.preventDefault();const name=document.querySelector('#customerName').value.trim()||'Customer';const service=select.value;const result=document.querySelector('#requestResult');result.textContent='Demo request created for '+name+' · '+service+'. No production order or payment was created.';result.classList.remove('hidden');showToast('Demo request created')});
document.querySelectorAll('.app-nav button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.app-nav button').forEach(item=>item.classList.remove('active'));button.classList.add('active');showToast(button.textContent+' view · prototype')}));
`;

  return [
    { path: "index.html", content: index },
    { path: "styles.css", content: styles },
    { path: "app.js", content: app },
    { path: "manifest.webmanifest", content: json(manifest) },
  ];
}

export function generateImplementation(request: ImplementationRequest): ImplementationBundle {
  const isSnake = request.domain === "game" && /snake/i.test(request.title);
  const mobileTargeted = request.targetPlatforms.some((platform) => ["android", "ios", "mobile"].includes(platform.toLowerCase()));
  const webTargeted = request.targetPlatforms.some((platform) => ["web", "website"].includes(platform.toLowerCase()));
  const universalProduct = request.domain !== "game";
  const templateId = isSnake
    ? "snake-web-v1"
    : request.domain === "game"
      ? "web-game-minimal"
      : mobileTargeted && webTargeted
        ? "universal-product-web-mobile-v1"
        : "web-app-v1";
  const files = [
    {
      path: "project.json",
      content: json({
        projectId: request.projectId,
        title: request.title,
        domain: request.domain,
        targetPlatforms: request.targetPlatforms,
        requirements: request.requirements,
      }),
    },
    {
      path: "README.md",
      content: `# ${request.title}\n\nGenerated by SMART OS inside an isolated workspace.\n`,
    },
  ];

  if (request.domain === "game") {
    files.push(
      {
        path: "index.html",
        content: "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\"><title>SMART OS Game</title><style>html,body{margin:0;background:#07090c;color:#fff;font-family:sans-serif}body{display:grid;place-items:center;min-height:100vh}canvas{width:min(92vw,360px);height:auto;border:1px solid #2a2f38;touch-action:none}</style></head><body><canvas id=\"game\" width=\"360\" height=\"640\"></canvas><script type=\"module\" src=\"./src/main.js\"></script></body></html>\n",
      },
      {
        path: "src/main.js",
        content: isSnake ? snakeSource() : "const canvas=document.querySelector('#game');const ctx=canvas.getContext('2d');ctx.fillStyle='#111';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.font='20px sans-serif';ctx.fillText('SMART OS prototype',70,320);\n",
      },
    );
  } else if (universalProduct) {
    files.push(...universalProductFiles(request));
  }

  return { projectId: request.projectId, templateId, files, requiresExternalExecution: false };
}
