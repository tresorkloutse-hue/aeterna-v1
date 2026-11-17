// Polymatch : page de moderation. Le script est coupe en trois fichiers charges dans l ordre,
// qui partagent la meme portee globale. La limite de taille de l outil de deploiement impose ce decoupage.
// 3/3 : attestations, journal, e-mails, messages de contact, navigation.
// ---------------------------------------------------------------- attestations
var certQuery="";
async function renderCerts(){
panel.innerHTML='<div class="adm-tools"><input type="text" id="adm-cq" placeholder="Code, titre du projet ou nom" value="'+E(certQuery)+'"><button class="btn secondary small" id="adm-cgo">Chercher</button></div><p class="field-hint">Révoquer une attestation est définitif : la page de vérification publique l’affichera comme révoquée, et les deux personnes sont prévenues par e-mail.</p><div id="adm-clist"><p class="empty-note">Chargement…</p></div>';
var q=document.getElementById("adm-cq");
document.getElementById("adm-cgo").addEventListener("click",function(){certQuery=q.value;loadCerts();});
q.addEventListener("keydown",function(e){if(e.key==="Enter"){certQuery=q.value;loadCerts();}});
loadCerts();}
async function loadCerts(){
var list=document.getElementById("adm-clist");
var rows=await call("admin_certificates",{p_query:certQuery,p_limit:200});
if(!rows.length){list.innerHTML='<p class="empty-note">Aucune attestation délivrée'+(certQuery?" ne correspond":"")+".</p>";return;}
list.innerHTML='<div class="id-card" style="padding-top:4px;padding-bottom:4px;">'+rows.map(function(c){
return '<div class="adm-row" data-id="'+E(c.id)+'"><div class="who"><div class="nm">'+E(c.title)+" "+(c.revoked_at?'<span class="adm-tag red">révoquée</span>':'<span class="adm-tag green">valide</span>')+'</div><p class="adm-small">'+E(c.owner_name||"?")+" et "+E(c.partner_name||"?")+" · délivrée le "+day(c.issued_at)+' · code <span class="verify-code">'+E(c.code)+"</span></p>"
+(c.revoked_at?'<p class="adm-small" style="color:#8f2d1c;">Révoquée le '+day(c.revoked_at)+(c.revoked_by_name?" par "+E(c.revoked_by_name):"")+" : "+E(c.revoke_reason||"")+"</p>":"")
+'</div><div class="adm-actions" style="margin-top:0;"><a class="btn secondary small" href="attestation.html?project='+E(c.project_id)+"&partner="+E(c.partner_id)+'" target="_blank" rel="noopener">Voir</a><a class="btn secondary small" href="verifier.html?code='+encodeURIComponent(c.code||"")+'" target="_blank" rel="noopener">Vérification publique</a>'
+(c.revoked_at?"":'<button class="btn danger small" data-revoke>Révoquer</button>')+"</div></div>";}).join("")+"</div>";
list.querySelectorAll("[data-revoke]").forEach(function(b){b.addEventListener("click",async function(){
var id=b.closest(".adm-row").getAttribute("data-id");
var r=ask("Motif de la révocation (visible par les deux personnes) :",true);if(!r)return;
if(!confirm("Révoquer définitivement cette attestation ? Ce n’est pas réversible."))return;
await call("admin_revoke_certificate",{p_completion:id,p_reason:r});say("Attestation révoquée.");loadCerts();});});}

// ---------------------------------------------------------------- journal
async function renderLog(){
loading();
var rows=await call("admin_log",{p_limit:300});
if(!rows.length){panel.innerHTML='<p class="empty-note" style="margin-top:18px;">Aucune action de modération pour l’instant.</p>';return;}
panel.innerHTML='<p class="field-hint">Toutes les décisions prises depuis cette page, dans l’ordre inverse. Le journal ne peut pas être modifié depuis le site.</p><div class="id-card" style="padding-top:4px;padding-bottom:4px;">'+rows.map(function(l){
return '<div class="adm-row"><div class="who"><div class="nm">'+E(ACTION[l.action]||l.action)+'</div><p class="adm-small">'+fmt(l.created_at)+(l.admin_name?" · par "+E(l.admin_name):"")+(l.target_kind&&l.target_kind!=="user"&&KIND[l.target_kind]?" · "+E(KIND[l.target_kind]):"")+(l.target_name?" · "+E(l.target_name):"")+"</p>"+(l.reason?'<p class="adm-small">Motif : '+E(l.reason)+"</p>":"")+"</div></div>";}).join("")+"</div>";}

// ---------------------------------------------------------------- e-mails
async function renderEmails(){
loading();
var o=await call("admin_overview");var rows=await call("admin_failed_emails");
panel.innerHTML='<div class="adm-cards">'+card(o.emails_sent_7d,"envoyés en 7 jours","")+card(o.emails_waiting,"en attente d’envoi","Le robot passe chaque minute.")+card(o.emails_failed,"en échec","Abandonnés après cinq essais.",o.emails_failed>0)+"</div>"
+(rows.length?'<div class="adm-actions"><button class="btn accent small" id="adm-retry">Relancer les e-mails en échec</button></div><div class="id-card" style="padding-top:4px;padding-bottom:4px;">'+rows.map(function(m){return '<div class="adm-row"><div class="who"><div class="nm">'+E(m.kind)+'</div><p class="adm-small">'+E(m.email)+" · "+fmt(m.created_at)+'</p><p class="adm-small" style="color:#8f2d1c;">'+E(m.error||"")+"</p></div></div>";}).join("")+"</div>":'<p class="empty-note">Aucun e-mail en échec.</p>');
var b=document.getElementById("adm-retry");
if(b)b.addEventListener("click",async function(){var r=await call("admin_retry_emails");say(n(r.retried)+" e-mail(s) remis dans la file.");renderEmails();});}

// ---------------------------------------------------------------- messages du formulaire de contact
var contactStatus="pending";
function mailtoHref(m){var o=m.subject?("Re : "+m.subject):"Votre message à Polymatch";return "mailto:"+encodeURIComponent(m.email||"")+"?subject="+encodeURIComponent(o);}
async function renderContact(){
loading();
var rows=await call("admin_contact_messages",{p_status:contactStatus,p_limit:200});
var head='<div class="adm-tools"><select id="adm-cstatus"><option value="pending"'+(contactStatus==="pending"?" selected":"")+'>En attente</option><option value="handled"'+(contactStatus==="handled"?" selected":"")+'>Déjà traités</option><option value="all"'+(contactStatus==="all"?" selected":"")+'>Tous</option></select><span class="adm-small">'+n(rows.length)+" message"+(rows.length>1?"s":"")+"</span></div>";
panel.innerHTML=head+'<p class="field-hint">Ces messages viennent de la page Contact. Répondre ouvre ton logiciel de courrier : ta réponse part alors de ton adresse, elle ne passe pas par le site.</p>'+(rows.length?rows.map(function(m){
var pending=!m.handled_at;
var qui=m.membre?'<span class="adm-tag teal">membre : '+E(m.membre)+"</span>":'<span class="adm-tag">visiteur</span>';
var adresse=m.email?'<a href="'+E(mailtoHref(m))+'">'+E(m.email)+"</a>":"adresse non fournie";
return '<div class="adm-item'+(pending?" pending":"")+'" data-id="'+E(m.id)+'"><div class="adm-head"><strong>'+E(m.subject||"Sans objet")+"</strong><span>"+fmt(m.created_at)+"</span>"+qui+(pending?"":'<span class="adm-tag green">traité le '+fmt(m.handled_at)+"</span>")+"</div>"
+'<p class="adm-small">'+E(m.name||"sans nom")+" · "+adresse+"</p>"
+'<div class="adm-quote">'+E(m.message)+"</div>"
+(m.note?'<p class="adm-small">Note : '+E(m.note)+"</p>":"")
+(pending?'<div class="adm-actions"><textarea placeholder="Note pour toi-même : ce que tu as répondu (facultatif)"></textarea>'+(m.email?'<a class="btn secondary small" href="'+E(mailtoHref(m))+'">Répondre par e-mail</a>':"")+'<button class="btn small" data-done>Marquer comme traité</button></div>':"")
+"</div>";}).join(""):'<p class="empty-note" style="margin-top:18px;">Aucun message.</p>');
var sel=document.getElementById("adm-cstatus");if(sel)sel.addEventListener("change",function(){contactStatus=sel.value;renderContact();});
panel.querySelectorAll("[data-done]").forEach(function(b){b.addEventListener("click",async function(){
var box=b.closest(".adm-item");var note=((box.querySelector("textarea")||{}).value||"").trim();
await call("admin_contact_handle",{p_id:box.getAttribute("data-id"),p_note:note||null});say("Message marqué comme traité.");renderContact();});});
try{var o=await call("admin_overview");updateContactCount(o.pending_contacts);}catch(e){}}

// ---------------------------------------------------------------- navigation
// ---------------------------------------------------------------- erreurs du navigateur
var ERR_GENRE={erreur:"Erreur de script",promesse:"Promesse rejetée",ressource:"Fichier non chargé"};
async function renderErrors(){
loading();
var rows=await call("admin_client_errors",{p_limit:200});
panel.innerHTML='<p class="field-hint">Ce que le navigateur des visiteurs a refusé d’exécuter. Une erreur casse en général une partie de la page sans que personne n’écrive pour le dire. Rien d’identifiant n’est enregistré : le chemin de la page, le message, la pile d’appel et une étiquette de navigateur. Les lignes de plus de trente jours partent d’elles-mêmes.</p>'
+(rows.length?'<div class="adm-actions"><button class="btn danger small" id="adm-eclear">Vider le journal</button></div><div class="id-card" style="padding-top:4px;padding-bottom:4px;">'+rows.map(function(e){
return '<div class="adm-row"><div class="who"><div class="nm">'+E(e.message)+'</div><p class="adm-small"><span class="adm-tag'+(e.kind==="erreur"?" red":"")+'">'+E(ERR_GENRE[e.kind]||e.kind)+"</span> · "+E(e.page||"?")
+(Number(e.occurrences)>1?" · "+n(e.occurrences)+" fois":"")+" · dernière le "+fmt(e.last_seen_at)+" · "+E(e.browser||"navigateur inconnu")+" · "+(e.signed_in?"personne connectée":"visiteur")+"</p>"
+(e.stack?'<pre class="adm-small" style="white-space:pre-wrap;word-break:break-word;color:#6b7280;margin:6px 0 0;">'+E(e.stack)+"</pre>":"")+"</div></div>";}).join("")+"</div>"
:'<p class="empty-note">Aucune erreur enregistrée. C’est la bonne nouvelle.</p>');
var b=document.getElementById("adm-eclear");
if(b)b.addEventListener("click",async function(){
if(!confirm("Vider le journal des erreurs ? Les lignes sont définitivement supprimées."))return;
var r=await call("admin_clear_client_errors");say(n(r.supprimees)+" ligne(s) supprimée(s).");updateErrorCount(0);renderErrors();});}

var RENDER={overview:renderOverview,reports:renderReports,members:renderMembers,hidden:renderHidden,certs:renderCerts,log:renderLog,contact:renderContact,emails:renderEmails,errors:renderErrors};
function show(tab){current=tab;pmShowMessage(msgEl,"");document.querySelectorAll("#adm-tabs .tab-btn").forEach(function(b){b.classList.toggle("current",b.getAttribute("data-tab")===tab);});
try{history.replaceState(null,"","#"+tab);}catch(e){}
RENDER[tab]().catch(function(){});}
document.querySelectorAll("#adm-tabs .tab-btn").forEach(function(b){b.addEventListener("click",function(){show(b.getAttribute("data-tab"));});});

(async function(){
var session=await pmInitNav("moderation.html");
if(!session){window.location.href="connexion.html?next=moderation.html";return;}
var r=await client.rpc("pm_is_admin");
var gate=document.getElementById("adm-gate");
// Deux echecs possibles, qui n appellent pas la meme reponse. Si la base n a pas
// pu repondre, c est presque toujours une session perdue : le dire, et proposer
// de se reconnecter. Si elle a repondu non, la page n existe pas pour ce visiteur.
if(r.error){gate.innerHTML='<div class="hero"><h1>Session à renouveler</h1><p class="sub">Tes droits n’ont pas pu être vérifiés : '+E(r.error.message||"réponse vide")+'. Reconnecte-toi, la page s’ouvrira ensuite normalement.</p><p><a class="btn accent" href="connexion.html?next=moderation.html">Se reconnecter</a></p></div>';return;}
if(r.data!==true){document.title="Page introuvable : Polymatch";gate.innerHTML='<div class="hero"><h1>Page introuvable</h1><p class="sub">Cette page n’existe pas ou n’est plus disponible.</p><p class="field-hint">Si tu es connecté avec un compte qui n’est pas le tien, <a href="connexion.html?next=moderation.html">reconnecte-toi</a>.</p><p><a href="index.html">Revenir à l’accueil</a></p></div>';return;}
gate.style.display="none";document.getElementById("adm").style.display="block";
var start=(location.hash||"").replace("#","");show(RENDER[start]?start:"overview");
})();
