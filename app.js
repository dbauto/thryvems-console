/**
 * ThryveMS platform console design preview.
 * All clients, numbers, identities and deployments are synthetic. No cloud calls.
 * Production must enforce authorization and tenant isolation at the API boundary.
 */
const CLIENTS = [
  {id:"demo-01",name:"Demo Manufacturing",domain:"demo-manufacturing.example",partner:"partner-a",plan:"Business",seats:32,used:24,live:"1.8.2",status:"Live",revenue:24500,allocated:8000,infra:1650,operations:2900},
  {id:"demo-02",name:"Sample Services",domain:"sample-services.example",partner:"partner-a",plan:"Team",seats:12,used:9,live:"1.8.1",status:"Live",revenue:13500,allocated:5200,infra:1140,operations:1800},
  {id:"demo-03",name:"Example Logistics",domain:"example-logistics.example",partner:"partner-b",plan:"Business",seats:46,used:40,live:"1.8.2",status:"Live",revenue:29500,allocated:10000,infra:1940,operations:3350},
  {id:"demo-04",name:"Test Retail",domain:"test-retail.example",partner:"partner-b",plan:"Trial",seats:10,used:0,live:null,status:"Not provisioned",revenue:0,allocated:0,infra:0,operations:0}
];
const RELEASES = [
  {version:"1.9.0-rc.1",status:"Testing",date:"23 Oct 2026",details:"Audit and onboarding improvements"},
  {version:"1.8.2",status:"Released",date:"18 Oct 2026",details:"Maintenance update"},
  {version:"1.8.1",status:"Released",date:"12 Oct 2026",details:"Navigation fixes"},
  {version:"1.8.0",status:"Released",date:"8 Oct 2026",details:"Previous stable version"}
];
const START_SANDBOXES = [
  {id:"sb-demo-01",clientId:"demo-01",version:"1.9.0-rc.1",status:"Ready for review",created:"23 Oct 2026"},
  {id:"sb-demo-03",clientId:"demo-03",version:"1.8.2",status:"Testing",created:"22 Oct 2026"}
];
const STORAGE_KEY = "thryvems.console.demo.v1";
function loadSandboxes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved) && saved.every(x => x && typeof x.id === "string" && typeof x.clientId === "string")) return saved.filter(x => CLIENTS.some(c => c.id === x.clientId));
  } catch (_) {}
  return START_SANDBOXES.map(x => ({...x}));
}
const state = {role:"developer",partner:"partner-a",page:"overview",search:"",client:"demo-01",sandboxes:loadSandboxes(),theme:"light"};
const NAV_DEVELOPER = [
  ["overview","Overview","▦"],["organisations","Organisations","▤"],["deployments","Deployments","▣"],
  ["releases","Releases","⇧"],["finance","Finance","▥"],["team","Platform team","♙"]
];
const NAV_PARTNER = [["overview","Overview","▦"],["clients","Clients","▤"],["finance","Finance","▥"]];
const money = n => "₱" + Math.round(n).toLocaleString("en-PH");
const sum = (items,key) => items.reduce((acc,item) => acc + (Number(item[key]) || 0),0);
const client = id => CLIENTS.find(c => c.id === id);
const safe = input => String(input == null ? "" : input).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const visibleClients = () => state.role === "developer" ? CLIENTS : CLIENTS.filter(c => c.partner === state.partner);
const tag = (label,tone) => '<span class="pill ' + (tone || "draft") + '">' + safe(label) + '</span>';
const status = s => tag(s, s === "Live" || s === "Released" || s === "Ready for review" ? "done" : s === "Testing" ? "progress" : s === "Not provisioned" ? "draft" : "soon");
const link = (label,act,id) => '<button class="table-link" data-act="' + act + '" data-id="' + safe(id) + '">' + safe(label) + '</button>';
function header(title, description, action, crumbs) {
  return '<section class="page-header"><div>'+(crumbs?'<div class="breadcrumb">'+safe(crumbs)+'</div>':'')+
    '<h1>'+safe(title)+'</h1><p>'+safe(description)+'</p></div>'+
    (action||'')+'</section>';
}
function metric(label,value,flag,icon) {
  return '<article class="metric"><div class="metric-top"><span class="metric-icon" aria-hidden="true">'+safe(icon)+'</span>'+
    (flag?tag(flag,flag==="Live"||flag==="On target"?"done":flag==="Attention"?"soon":"draft"):'')+
    '</div><div><strong>'+safe(value)+'</strong><div class="metric-label">'+safe(label)+'</div></div></article>';
}
function table(columns,rows,emptyTitle,emptyDesc) {
  const head = columns.map(c => '<th scope="col">'+safe(c)+'</th>').join("");
  const body = rows.length?rows.join(""):'<tr><td colspan="'+columns.length+'"><div class="empty"><strong>'+
    safe(emptyTitle||"No records")+'</strong>'+safe(emptyDesc||"Records will appear here.")+'</div></td></tr>';
  return '<div class="card"><div class="table-scroll"><table class="data-table"><thead><tr>'+head+
    '</tr></thead><tbody>'+body+'</tbody></table></div><div class="table-footer"><span>'+
    rows.length+' record'+(rows.length===1?"":"s")+'</span><span>10 rows per page · Preview data</span></div></div>';
}
function rowCells(cells) {return '<tr>'+cells.map(c=>'<td>'+c+'</td>').join("")+'</tr>';}
function control(label,kind,id,value,options) {
  return '<div class="field"><label for="'+safe(id)+'">'+safe(label)+'</label>'+
    (kind==="select"?'<select id="'+safe(id)+'">'+options.map(o=>'<option value="'+safe(o.value)+'" '+(o.value===value?'selected':'')+'>'+safe(o.label)+'</option>').join('')+'</select>':
    '<input id="'+safe(id)+'" type="'+safe(kind)+'" value="'+safe(value||"")+'" />')+'</div>';
}
function actionButton(text,act,cls,id,disabled) {return '<button type="button" class="btn '+(cls||'')+'" data-act="'+act+'"'+(id?' data-id="'+safe(id)+'"':'')+(disabled?' disabled title="Requires approved backend release controls"':'')+'>'+safe(text)+'</button>';}
function previewNote() {
  return '<div class="preview-note" role="note"><span aria-hidden="true">ⓘ</span><div><strong>Design preview · Synthetic data only.</strong> No cloud environments, releases, invoices, access grants or costs are connected. Actions marked Preview update this browser only; production changes are disabled.</div></div>';
}
function developerOverview() {
  const live=CLIENTS.filter(c=>c.status==="Live").length;
  const cost=sum(CLIENTS,"infra")+sum(CLIENTS,"operations");
  const open=state.sandboxes.length;
  const finance=sum(CLIENTS,"revenue")-cost;
  return header("Developer overview","Manage clients, deployment environments and platform performance.")+
    '<section class="metrics" aria-label="Platform figures">'+metric("Client organisations",CLIENTS.length,"Sample data","▤")+
    metric("Live deployments",live,"Live","▣")+metric("Sandboxes",open,"Sample data","◇")+
    metric("Actual operating profit",money(finance),"Sample data","▥")+'</section>'+
    '<section class="split"><article class="card"><div class="card-head"><div><h2>Client environments</h2><p>Production versions and independent testing environments.</p></div>'+
    actionButton("View deployments","go","btn-small","deployments")+'</div>'+
    CLIENTS.map(c=>'<div class="rule-row"><div><div class="row-primary">'+safe(c.name)+'</div><div class="secondary">Production '+safe(c.live||"Not provisioned")+' · '+state.sandboxes.filter(s=>s.clientId===c.id).length+' sandbox(es)</div></div>'+status(c.status)+'</div>').join("")+
    '</article><article class="card"><div class="card-head"><div><h2>Release workflow</h2><p>Testing happens before any client production change.</p></div></div>'+
    ['Create an isolated sandbox','Test changes with synthetic records','Review results and approval','Release or roll back with an audit record'].map((x,i)=>'<div class="rule-row"><div><div class="row-primary">'+(i+1)+'. '+x+'</div><div class="secondary">'+(i===3?'Production integration is not connected.':'Available as a design preview only.')+'</div></div>'+tag(i===3?"Pending":"Design","draft")+'</div>').join("")+'</article></section>';
}
function organisations(){
  return header("Organisations","Client accounts are separate from cloud provisioning.",
    actionButton("New organisation","new-organisation","btn-primary",null,true))+
    table(["Organisation","Partner","Plan","Seats","Production","Action"],
      visibleClients().map(c=>rowCells([
        '<div>'+link(c.name,"detail",c.id)+'<div class="secondary">'+safe(c.domain)+'</div></div>',
        safe(c.partner==="partner-a"?"Partner A":"Partner B"),safe(c.plan),safe(c.used+" of "+c.seats),status(c.status),
        actionButton("View","detail","btn-small",c.id)
      ])),"No organisations","Create an organisation after account provisioning is connected.");
}
function deployments(){
  const filtered=CLIENTS.filter(c=>c.name.toLowerCase().includes(state.search.toLowerCase()) || c.domain.toLowerCase().includes(state.search.toLowerCase()));
  const rows=filtered.map(c=>rowCells([
    '<div>'+link(c.name,"detail",c.id)+'<div class="secondary">'+safe(c.domain)+'</div></div>',
    c.live?safe("v"+c.live):'<span class="muted">Not deployed</span>',
    status(c.status),
    safe(state.sandboxes.filter(s=>s.clientId===c.id).length),
    '<div class="inline-actions">'+actionButton("Environments","detail","btn-small",c.id)+
    actionButton("Create sandbox","create-sandbox","btn-small",c.id)+'</div>'
  ]));
  return header("Deployments","Each client has its own production environment and optional isolated sandbox.",
    actionButton("+ Create sandbox","create-sandbox","btn-primary"))+
    '<div class="toolbar"><div class="field"><label for="client-filter">Find a client</label><input id="client-filter" type="search" placeholder="Search name or domain" value="'+safe(state.search)+'" /></div>'+
    actionButton("Search","search","btn-small")+'</div>'+
    table(["Client","Production version","Production status","Sandboxes","Actions"],rows,"No clients match","Try another client name.")+
    '<section class="card"><div class="card-head"><div><h2>Sandbox environments</h2><p>Separate testing environments. Never share a production database.</p></div></div>'+
    (state.sandboxes.length?state.sandboxes.map(s=>'<div class="rule-row"><div><div class="row-primary">'+safe(client(s.clientId)?.name||"")+' · Sandbox</div>'+
    '<div class="secondary">Version '+safe(s.version)+' · '+safe(s.created)+' · '+safe(s.purpose||"Version validation")+(s.reference?' · '+safe(s.reference):'')+' · Synthetic data</div></div><div class="inline-actions">'+status(s.status)+
    actionButton("Compare","compare","btn-small",s.id)+actionButton("Promote","promote","btn-small",s.id,true)+actionButton("Remove","remove-sandbox","btn-small btn-danger",s.id)+'</div></div>').join(""):'<div class="empty"><strong>No sandboxes</strong>Create one to preview an isolated environment.</div>')+'</section>';
}
function releases(){
  return header("Releases","Review application versions before a client receives an update.")+
    '<section class="metrics">'+metric("Available versions",RELEASES.length,"Sample data","⇧")+
    metric("Testing version","1.9.0-rc.1","Sample data","◇")+
    metric("Clients on v1.8.2",CLIENTS.filter(c=>c.live==="1.8.2").length,"Sample data","▣")+
    metric("Pending approvals","No data",null,"✓")+'</section>'+
    table(["Version","Status","Date","Release notes","Action"],
      RELEASES.map(r=>rowCells([safe(r.version),status(r.status),safe(r.date),safe(r.details),
      actionButton("Compare","compare-release","btn-small",r.version)])),"No releases","Release history appears after integration.")+
    '<div class="alert"><strong>Production deployments are disabled.</strong> Release approval, checks, an audit trail and rollback must be implemented and verified in the backend before this control is enabled.</div>';
}
function developerFinance(){
  const revenue=sum(CLIENTS,"revenue"),infra=sum(CLIENTS,"infra"),ops=sum(CLIENTS,"operations");
  const rows=CLIENTS.map(c=>rowCells([link(c.name,"detail",c.id),money(c.revenue),money(c.infra),money(c.operations),money(c.revenue-c.infra-c.operations)]));
  return header("Finance","Internal finances: actual infrastructure expenses are visible only in the Developer View.")+
    '<section class="metrics">'+metric("Revenue",money(revenue),"Sample data","▥")+metric("Infrastructure",money(infra),"Sample data","▣")+
    metric("Other expenses",money(ops),"Sample data","▤")+metric("Actual operating profit",money(revenue-infra-ops),"Sample data","✓")+'</section>'+
    table(["Client","Revenue","Infrastructure","Other expenses","Actual operating profit"],rows,"No finances","Finances appear here.")+
    '<div class="footer-caption">These are illustrative amounts, not data from Cloudflare, Neon or billing systems. Currency: PHP.</div>';
}
function platformTeam(){
  return header("Platform team","Developer access stays separate from business partner permissions.")+
  '<article class="card"><div class="card-head"><h2>Role boundaries</h2></div>'+
  '<div class="rule-row"><div><div class="row-primary">Platform owner</div><div class="secondary">Deployment management, actual costs, releases and system administration</div></div>'+tag("Developer","progress")+'</div>'+
  '<div class="rule-row"><div><div class="row-primary">Business partner</div><div class="secondary">Assigned clients, commercial revenue, allocated expenses and reporting only</div></div>'+tag("Partner","draft")+'</div>'+
  '<div class="rule-row"><div><div class="row-primary">Client users</div><div class="secondary">No platform or partner console access</div></div>'+tag("No access","draft")+'</div></article>'+
  '<div class="alert">In production, Cloudflare Access, application identity and server-side role and client-assignment checks must all be enforced. A UI role switch is not an access-control mechanism.</div>';
}
function partnerOverview(){
  const list=visibleClients(),rev=sum(list,"revenue"),expense=sum(list,"allocated");
  return header("Business overview","Commercial performance for clients assigned to this business partner.")+
  '<section class="metrics">'+metric("Assigned clients",list.length,"Sample data","▤")+
  metric("Revenue",money(rev),"Sample data","▥")+metric("Assigned expenses",money(expense),"Sample data","▣")+
  metric("Reported profit",money(rev-expense),"Sample data","✓")+'</section>'+
  '<section class="split"><article class="card"><div class="card-head"><h2>Assigned clients</h2></div>'+
  list.map(c=>'<div class="rule-row"><div><div class="row-primary">'+link(c.name,"detail",c.id)+'</div><div class="secondary">'+safe(c.plan)+' · '+safe(c.used+" of "+c.seats)+" seats"+'</div></div>'+status(c.status)+'</div>').join("")+
  '</article><article class="card"><div class="card-head"><div><h2>Commercial distribution</h2><p>Illustrative profit-sharing allocation.</p></div></div>'+
  '<div class="rule-row"><div><div class="row-primary">30% developer allocation</div><div class="secondary">Of reported profit</div></div><strong>'+money((rev-expense)*.3)+'</strong></div>'+
  '<div class="rule-row"><div><div class="row-primary">70% business partner allocation</div><div class="secondary">Of reported profit</div></div><strong>'+money((rev-expense)*.7)+'</strong></div>'+
  '</article></section><p class="footer-caption">Partner financial figures use assigned business expenses, not private infrastructure costs. Actual contractual distributions require approved accounting rules.</p>';
}
function partnerClients(){
  return header("Clients","Clients assigned to this partner. Their QMS records and deployment details are not available.")+
  table(["Client","Plan","Seats","Status","Action"],visibleClients().map(c=>rowCells([
    '<div>'+link(c.name,"detail",c.id)+'<div class="secondary">'+safe(c.domain)+'</div></div>',
    safe(c.plan),safe(c.used+" of "+c.seats),status(c.status),actionButton("View details","detail","btn-small",c.id)
  ])),"No clients assigned","Clients appear here when the platform owner assigns them to you.");
}
function partnerFinance(){
  const list=visibleClients(),revenue=sum(list,"revenue"),assigned=sum(list,"allocated"),profit=revenue-assigned;
  return header("Finance","Business revenue and allocated client expenses. Developer operating costs remain private.")+
  '<section class="metrics">'+metric("Revenue",money(revenue),"Sample data","▥")+metric("Assigned expenses",money(assigned),"Sample data","▤")+
  metric("Reported profit",money(profit),"Sample data","✓")+metric("Partner allocation · 70%",money(profit*.7),"Sample data","◇")+'</section>'+
  table(["Client","Revenue","Assigned expenses","Reported profit"],list.map(c=>rowCells([
    link(c.name,"detail",c.id),money(c.revenue),money(c.allocated),money(c.revenue-c.allocated)
  ])),"No financial data","Assigned client finances appear here.")+
  '<p class="footer-caption">Sample PHP figures, not issued invoices or payment statements. Actual developer infrastructure and internal operating costs are never displayed here.</p>';
}
function pageContent(){
  if(state.role==="client")return header("Page not found","This page or record does not exist.");
  if(state.role==="developer"){
    return {overview:developerOverview,organisations,deployments,releases,finance:developerFinance,team:platformTeam}[state.page]?.()||developerOverview();
  }
  return {overview:partnerOverview,clients:partnerClients,finance:partnerFinance}[state.page]?.()||partnerOverview();
}
function render(){
  document.documentElement.classList.toggle("dark",state.theme==="dark");
  const partner=state.role==="partner";
  const nav=partner?NAV_PARTNER:NAV_DEVELOPER;
  if(!nav.some(x=>x[0]===state.page))state.page="overview";
  const title=partner?"ThryveMS Business":state.role==="client"?"ThryveMS":"ThryveMS Platform";
  const menu=nav.map(n=>'<button data-act="go" data-id="'+n[0]+'" class="'+(state.page===n[0]?"active":"")+'" '+(state.page===n[0]?'aria-current="page"':'')+
    '><span class="nav-icon" aria-hidden="true">'+n[2]+'</span>'+safe(n[1])+'</button>').join("");
  document.getElementById("app").innerHTML=
    '<div class="app-shell"><aside class="sidebar" aria-label="Console navigation"><div class="brand"><span class="brand-mark">T</span><span><strong>'+title+'</strong><small>'+ (partner?"Business management":"Platform control") +'</small></span></div>'+
    '<nav class="nav"><div class="nav-label">Workspace</div>'+menu+'</nav>'+
    '<div class="sidebar-footer">ThryveMS console<br/>Design preview · 24 Oct 2026<br/>No production connection</div></aside>'+
    '<div class="workspace"><header class="topbar"><div class="topbar-left"><span class="brand-mark" aria-hidden="true" style="width:30px;height:30px">T</span><strong>'+safe(title)+'</strong></div>'+
    '<div class="topbar-right"><div class="field"><label for="preview-role" class="tiny">Preview, view as</label><select id="preview-role" aria-label="Preview, view as">'+
    '<option value="developer" '+(state.role==="developer"?"selected":"")+'>Platform owner</option><option value="partner-a" '+(state.role==="partner"&&state.partner==="partner-a"?"selected":"")+'>Partner A</option>'+
    '<option value="partner-b" '+(state.role==="partner"&&state.partner==="partner-b"?"selected":"")+'>Partner B</option><option value="client" '+(state.role==="client"?"selected":"")+'>Client user (no access)</option></select></div>'+
    '<button class="btn btn-small" data-act="theme" aria-label="Toggle light and dark appearance">'+(state.theme==="light"?"Dark view":"Light view")+'</button>'+
    tag("Preview only","draft")+'</div></header>'+
    '<nav class="mobile-nav" aria-label="Console pages">'+nav.map(n=>'<button data-act="go" data-id="'+n[0]+'" class="'+(state.page===n[0]?"active":"")+'">'+safe(n[1])+'</button>').join("")+'</nav>'+
    '<main class="content" id="page">'+previewNote()+pageContent()+'</main></div></div>';
}
function fact(label,value){return '<div class="fact"><label>'+safe(label)+'</label><strong>'+safe(value)+'</strong></div>';}
function modal(title,description,body,footer){
  document.getElementById("dialog-root").innerHTML='<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">'+
  '<div class="modal-header"><h2 id="dialog-title">'+safe(title)+'</h2><p>'+safe(description)+'</p></div>'+
  '<div class="modal-content">'+body+'</div><div class="modal-footer">'+(footer||actionButton("Close","close"))+'</div></section></div>';
  document.querySelector(".modal [data-act]")?.focus();
}
function detail(id){
  const c=visibleClients().find(x=>x.id===id);
  if(!c)return modal("Page not found","You cannot view this client.","",""); 
  const dev=state.role==="developer";
  const body='<div class="detail-grid">'+fact("Client",c.name)+fact("Plan",c.plan)+fact("Seats",c.used+" of "+c.seats)+fact("Status",c.status)+
    (dev?fact("Production version",c.live||"Not provisioned")+fact("Sandboxes",String(state.sandboxes.filter(s=>s.clientId===id).length)):
    fact("Monthly revenue",money(c.revenue))+fact("Assigned expenses",money(c.allocated)))+'</div>'+
    (dev?'<div class="alert">This browser preview cannot create real Cloudflare resources. The sandbox action below only adds a sample record.</div>':
    '<p class="small muted">Deployment versions, actual operating costs and client QMS records are not available in the Business View.</p>');
  modal(c.name,dev?"Developer environment and account summary.":"Commercial account details.",body,
    actionButton("Close","close")+(dev?actionButton("Create sandbox","create-sandbox","btn-primary",id):""));
}
function sandboxDialog(defaultId){
  const c=client(defaultId)||CLIENTS.find(x=>x.live)||CLIENTS[0];
  const options=CLIENTS.filter(x=>x.live).map(x=>'<option value="'+safe(x.name)+'"></option>').join("");
  modal("Create client sandbox","Clone a client's app version and configuration into an isolated preview environment.",
    '<div class="field"><label for="sandbox-client">Client (type a name to search)</label><input id="sandbox-client" list="sandbox-options" required value="'+safe(c.name)+'" autocomplete="off" /><datalist id="sandbox-options">'+options+'</datalist></div>'+
    control("Application version","select","sandbox-version",c.live,RELEASES.map(x=>({value:x.version,label:"v"+x.version})))+
    control("Change type","select","sandbox-purpose","Bug fix",[{value:"Bug fix",label:"Bug fix"},{value:"Feature update",label:"Feature update"},{value:"Version validation",label:"Version validation"}])+
    control("Issue or change reference","text","sandbox-reference","",[])+
    '<div class="field"><label>Test data</label><input value="Synthetic sample data only" disabled /><small>No production QMS records, secrets, emails, auth tokens or customer database copies.</small></div>'+
    '<div class="alert">Preview action only. This does not create a Cloudflare Worker, Neon project or hosted URL. Provisioning needs an audited backend workflow.</div>'+
    '<p class="small" id="sandbox-error" role="alert"></p>',
    actionButton("Cancel","close")+actionButton("Create preview sandbox","save-sandbox","btn-primary"));
}
function compareSandbox(id){
  const s=state.sandboxes.find(x=>x.id===id);if(!s)return;
  const c=client(s.clientId);
  modal("Compare versions",c.name+" · Environment comparison",
    '<div class="detail-grid">'+fact("Production",c.live||"Not provisioned")+fact("Sandbox",s.version)+fact("Data","Separate synthetic data")+fact("Review status",s.status)+fact("Change type",s.purpose||"Version validation")+fact("Change reference",s.reference||"Not entered")+'</div>'+
    '<div class="alert">Code/configuration diff and compatibility gates require integration with a version registry. No actual production change is available in this preview.</div>');
}
function saveSandboxes(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state.sandboxes));}
function createSandbox(){
  const typed=document.getElementById("sandbox-client")?.value.trim().toLowerCase();
  const c=CLIENTS.find(x=>x.name.toLowerCase()===typed && x.live);
  const ver=document.getElementById("sandbox-version")?.value;
  const purpose=document.getElementById("sandbox-purpose")?.value||"Bug fix";
  const reference=(document.getElementById("sandbox-reference")?.value||"").trim().slice(0,100);
  const err=document.getElementById("sandbox-error");
  if(!c){if(err)err.textContent="Choose a live client from the matching names.";return;}
  if(!RELEASES.some(x=>x.version===ver)){if(err)err.textContent="Choose a known application version.";return;}
  if(state.sandboxes.some(s=>s.clientId===c.id)){if(err)err.textContent="This client already has a preview sandbox. Remove it before creating another.";return;}
  state.sandboxes.push({id:"sb-preview-"+c.id,clientId:c.id,version:ver,status:"Draft",created:"24 Oct 2026",purpose,reference});
  saveSandboxes();document.getElementById("dialog-root").innerHTML="";state.page="deployments";render();
}
document.addEventListener("click", e=>{
  const b=e.target.closest("[data-act]");if(!b)return;
  const act=b.dataset.act,id=b.dataset.id;
  if(act==="go"){state.page=id;state.search="";render();}
  if(act==="theme"){state.theme=state.theme==="dark"?"light":"dark";render();}
  if(act==="search"){state.search=document.getElementById("client-filter")?.value.trim()||"";render();}
  if(act==="detail"){detail(id);}
  if(act==="create-sandbox" && state.role==="developer"){sandboxDialog(id);}
  if(act==="save-sandbox" && state.role==="developer"){createSandbox();}
  if(act==="compare"){compareSandbox(id);}
  if(act==="compare-release"){modal("Release details","Version "+id,
    '<div class="alert">Release notes are illustrative. Actual comparison requires the approved build manifest, validation results and audit records.</div>');}
  if(act==="remove-sandbox" && state.role==="developer"){modal("Remove preview sandbox","This will only remove the sample record in this browser.",
    '<p>Production is unaffected. This is not a cloud deprovisioning operation.</p>',
    actionButton("Cancel","close")+actionButton("Remove sample sandbox","confirm-remove","btn-danger",id));}
  if(act==="confirm-remove" && state.role==="developer"){state.sandboxes=state.sandboxes.filter(x=>x.id!==id);saveSandboxes();document.getElementById("dialog-root").innerHTML="";render();}
  if(act==="close"){document.getElementById("dialog-root").innerHTML="";}
});
document.addEventListener("change",e=>{
  if(e.target.id==="preview-role"){
    const v=e.target.value;
    state.role=v==="developer"?"developer":v==="client"?"client":"partner";
    if(v.startsWith("partner-"))state.partner=v;
    state.page="overview";state.search="";document.getElementById("dialog-root").innerHTML="";render();
  }
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")document.getElementById("dialog-root").innerHTML="";
  if(e.key==="Enter"&&e.target.id==="client-filter"){state.search=e.target.value.trim();render();}
});
render();
