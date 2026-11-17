// Polymatch : page de moderation. Le script est coupe en trois fichiers charges dans l ordre,
// qui partagent la meme portee globale. La limite de taille de l outil de deploiement impose ce decoupage.
// 2/3 : membres et contenus masques.
// ---------------------------------------------------------------- membres
var memberQuery="";
async function renderMembers(){
panel.innerHTML='<div class="adm-tools"><input type="text" id="adm-mq" placeholder="Nom, e-mail ou discipline" value="'+E(memberQuery)+'"><button class="btn secondary small" id="adm-mgo">Chercher</button></div><div id="adm-mlist"><p class="empty-note">Chargement…</p></div>';
var q=document.getElementById("adm-mq");
document.getElementById("adm-mgo").addEventListener("click",function(){memberQuery=q.value;loadMembers();});
q.addEventListener("keydown",function(e){if(e.key==="Enter"){memberQuery=q.value;loadMembers();}});
loadMembers();}
async function loadMembers(){
var list=document.getElementById("adm-mlist");
var rows=await call("admin_members",{p_query:memberQuery,p_limit:200});
if(!rows.length){list.innerHTML='<p class="empty-note">Aucun compte ne correspond.</p>';return;}
list.innerHTML='<p class="adm-small">'+n(rows.length)+" compte"+(rows.length>1?"s":"")+'</p><div class="id-card" style="padding-top:4px;padding-bottom:4px;">'+rows.map(function(m){
var tags=(m.is_admin?'<span class="adm-tag teal">administrateur</span> ':"")+(m.account_type==="institution"?'<span class="adm-tag">institution</span> ':"")+(m.suspended?'<span class="adm-tag red">suspendu</span> ':"")+(m.hidden?'<span class="adm-tag red">profil masqué</span> ':"")+(!m.has_profile?'<span class="adm-tag">sans profil</span> ':"")+(!m.confirmed?'<span class="adm-tag">e-mail non confirmé</span> ':"")+(m.reports_against>0?'<span class="adm-tag red">'+n(m.reports_against)+" signalement"+(m.reports_against>1?"s":"")+"</span> ":"");
var acts="";
if(!m.is_admin){
 if(m.has_profile)acts+='<a class="btn secondary small" href="profil-public.html?id='+E(m.id)+'" target="_blank" rel="noopener">Profil</a>';
 acts+='<a class="btn secondary small" href="messagerie.html?to='+E(m.id)+'" target="_blank" rel="noopener">Écrire</a>';
 acts+='<button class="btn secondary small" data-m="warn">Avertir</button>';
 if(m.has_profile)acts+='<button class="btn secondary small" data-m="'+(m.hidden?"unhide":"hide")+'">'+(m.hidden?"Réafficher le profil":"Masquer le profil")+"</button>";
 acts+='<button class="btn '+(m.suspended?"secondary":"danger")+' small" data-m="'+(m.suspended?"unsuspend":"suspend")+'">'+(m.suspended?"Réintégrer":"Suspendre")+"</button>";}
return '<div class="adm-row" data-id="'+E(m.id)+'"><div class="who"><div class="nm">'+E(m.name||"(profil non rempli)")+" "+tags+'</div><p class="adm-small">'+E(m.email||"")+(m.discipline?" · "+E(m.discipline):"")+"</p>"
+'<p class="adm-small">Inscrit le '+day(m.signed_up)+" · dernière connexion : "+day(m.last_sign_in)+" · "+n(m.projects)+" projet"+(m.projects>1?"s":"")+" · "+n(m.messages_7d)+" message"+(m.messages_7d>1?"s":"")+" en 7 jours"+(m.notifications?"":" · notifications coupées")+"</p>"
+(m.suspended?'<p class="adm-small" style="color:#8f2d1c;">Suspendu le '+day(m.suspended_at)+" : "+E(m.suspension_reason||"")+"</p>":"")
+'</div><div class="adm-actions" style="margin-top:0;">'+acts+"</div></div>";}).join("")+"</div>";
list.querySelectorAll("[data-m]").forEach(function(b){b.addEventListener("click",async function(){
var id=b.closest(".adm-row").getAttribute("data-id");var a=b.getAttribute("data-m");
if(a==="warn"){var t=ask("Message d’avertissement (envoyé par la messagerie, avec un e-mail) :",true);if(!t)return;await call("admin_warn",{p_user:id,p_text:t});say("Avertissement envoyé.");return;}
if(a==="suspend"){var r=ask("Motif de la suspension (le compte ne pourra plus rien publier ni modifier) :",true);if(!r)return;await call("admin_suspend",{p_user:id,p_suspend:true,p_reason:r});say("Compte suspendu.");}
if(a==="unsuspend"){if(!confirm("Réintégrer ce compte ?"))return;await call("admin_suspend",{p_user:id,p_suspend:false,p_reason:null});say("Compte réintégré.");}
if(a==="hide"){var h=ask("Motif du masquage du profil :",true);if(!h)return;await call("admin_set_hidden",{p_kind:"profile",p_id:id,p_hidden:true,p_reason:h});say("Profil masqué.");}
if(a==="unhide"){await call("admin_set_hidden",{p_kind:"profile",p_id:id,p_hidden:false,p_reason:null});say("Profil réaffiché.");}
loadMembers();});});}

// ---------------------------------------------------------------- contenus masques
async function renderHidden(){
loading();
var rows=await call("admin_hidden");
if(!rows.length){panel.innerHTML='<p class="empty-note" style="margin-top:18px;">Aucun contenu masqué.</p>';return;}
panel.innerHTML='<p class="field-hint">Ces contenus sont invisibles pour tous les membres. Les rétablir les remet en ligne tels quels.</p>'+rows.map(function(h){
return '<div class="adm-item" data-kind="'+E(h.kind)+'" data-id="'+E(h.id)+'"><div class="adm-head"><strong>'+E(KIND[h.kind]||h.kind)+"</strong><span>masqué le "+fmt(h.hidden_at)+"</span></div>"+targetHtml(h.preview,h.kind)+'<div class="adm-actions"><button class="btn secondary small" data-restore>Rétablir</button></div></div>';}).join("");
panel.querySelectorAll("[data-restore]").forEach(function(b){b.addEventListener("click",async function(){
var box=b.closest(".adm-item");if(!confirm("Remettre ce contenu en ligne ?"))return;
await call("admin_set_hidden",{p_kind:box.getAttribute("data-kind"),p_id:box.getAttribute("data-id"),p_hidden:false,p_reason:null});say("Contenu rétabli.");renderHidden();});});}
