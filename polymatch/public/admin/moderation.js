// Polymatch : page de moderation. Le script est coupe en trois fichiers charges dans l ordre,
// qui partagent la meme portee globale. La limite de taille de l outil de deploiement impose ce decoupage.
// 1/3 : outils communs, vue d ensemble, signalements.
var E=pmEscape;
var KIND={message:"Message privé",profile:"Profil",project:"Projet",opening:"Ouverture",comment:"Réaction à une ouverture",team_message:"Message d’équipe"};
var DECISION={dismiss:"Classé sans suite",hide:"Contenu masqué",hide_suspend:"Contenu masqué et auteur suspendu"};
var ACTION={"masquer":"Contenu masqué","retablir":"Contenu rétabli","suspendre":"Compte suspendu","reintegrer":"Compte réintégré","avertir":"Avertissement envoyé","decider:dismiss":"Signalement classé sans suite","decider:hide":"Signalement : contenu masqué","decider:hide_suspend":"Signalement : contenu masqué, auteur suspendu","revoquer_attestation":"Attestation révoquée","relancer_emails":"E-mails relancés","rapport_active":"Rapport hebdomadaire activé","rapport_coupe":"Rapport hebdomadaire coupé"};
// Ce que le site coute et ou il vit. Rien ici ne vient de la base : ce sont des
// faits d administration qui ne changent qu a la main, le jour ou l un d eux bouge.
var INFRA={
domaine:"polymatch.org",
achete:"25 septembre 2026",
expire:"25 septembre 2027",
prix:"8,49 USD la première année",
renouvellement:"automatique, au tarif en vigueur à la date du renouvellement",
registraire:"Vercel",
alias:[["www.polymatch.org","redirige vers polymatch.org (308)"],["polymatch-site.vercel.app","ancienne adresse, toujours servie"]],
liens:[["Domaines et renouvellement","https://vercel.com/tresorkloutse-hues-projects/~/domains"],["Factures et carte","https://vercel.com/tresorkloutse-hues-projects/~/settings/billing"],["Base de données","https://supabase.com/dashboard/project/ytpzbhlsjvkapqdmkiyi"]],
hebergement:"Vercel, projet polymatch-site, publié à chaque envoi sur la branche main",
base:"Supabase, projet ytpzbhlsjvkapqdmkiyi, serveurs à Paris"};

var panel=document.getElementById("adm-panel");var msgEl=document.getElementById("adm-msg");
var current="overview";

function fmt(iso){if(!iso)return "";try{return new Date(iso).toLocaleString("fr-FR",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}catch(e){return "";}}
function day(iso){if(!iso)return "jamais";try{return new Date(iso).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});}catch(e){return "";}}
function n(v){return Number(v||0).toLocaleString("fr-FR");}
function say(text,type){pmShowMessage(msgEl,text,type||"ok");if(text)window.scrollTo({top:0,behavior:"smooth"});}
async function call(fn,args){var r=await client.rpc(fn,args||{});if(r.error){say("Erreur : "+r.error.message,"error");throw r.error;}return r.data;}
function loading(){panel.innerHTML='<p class="empty-note" style="margin-top:18px;">Chargement…</p>';}
function ask(question,required){var v=prompt(question);if(v===null)return null;v=v.trim();if(required&&!v){alert("Un motif est obligatoire.");return null;}return v;}

// ---------------------------------------------------------------- vue d ensemble
function card(num,label,sub,alert){return '<div class="adm-card'+(alert?" alert":"")+'"><div class="n">'+n(num)+'</div><div class="l">'+E(label)+"</div>"+(sub?'<div class="s">'+sub+"</div>":"")+"</div>";}
function infraLigne(cle,valeur){return '<div class="adm-row"><div class="who"><span class="nm">'+E(cle)+'</span></div><div class="adm-small" style="flex:1 1 320px;text-align:right;">'+valeur+"</div></div>";}
function infraHtml(){
var i=INFRA;
var alias=i.alias.map(function(a){return "<strong>"+E(a[0])+"</strong> : "+E(a[1]);}).join("<br>");
var liens=i.liens.map(function(l){return '<a href="'+E(l[1])+'" target="_blank" rel="noopener">'+E(l[0])+"</a>";}).join(" &nbsp;·&nbsp; ");
return '<h2 class="section-title">Le domaine et l\u2019h\u00e9bergement</h2>'
+'<div class="id-card"><p class="adm-small" style="margin-top:0;">Ces informations ne viennent pas de la base : elles sont \u00e9crites en clair dans le script de cette page, et se modifient le jour o\u00f9 l\u2019une d\u2019elles change.</p>'
+infraLigne("Adresse du site",'<a href="https://'+E(i.domaine)+'" target="_blank" rel="noopener">'+E(i.domaine)+"</a>")
+infraLigne("Achet\u00e9 le",E(i.achete)+" aupr\u00e8s de "+E(i.registraire))
+infraLigne("\u00c0 renouveler avant le","<strong>"+E(i.expire)+"</strong>")
+infraLigne("Prix",E(i.prix))
+infraLigne("Renouvellement",E(i.renouvellement))
+infraLigne("Autres adresses",alias)
+infraLigne("H\u00e9bergement",E(i.hebergement))
+infraLigne("Base de donn\u00e9es",E(i.base))
+infraLigne("O\u00f9 g\u00e9rer",liens)
+"</div>"
+'<h2 class="section-title">Sauvegarde</h2>'
+'<div class="id-card"><p class="adm-small" style="margin-top:0;">Le plan gratuit de Supabase ne propose aucune sauvegarde t\u00e9l\u00e9chargeable. Ce bouton exporte toutes les donn\u00e9es dans un fichier, \u00e0 garder ailleurs que sur le site. Le sch\u00e9ma, lui, vit d\u00e9j\u00e0 dans le d\u00e9p\u00f4t Git.</p>'
+'<p class="adm-small">Le fichier contient les messages priv\u00e9s et les documents des membres. Il ne contient ni secrets ni mots de passe. Traite-le comme un document confidentiel.</p>'
+'<div class="adm-actions"><button class="btn secondary small" id="adm-sauvegarde">T\u00e9l\u00e9charger une sauvegarde</button><span class="adm-small" id="adm-sauvegarde-etat"></span></div></div>';}

async function renderOverview(){
loading();
var o=await call("admin_overview");var w=o.week||{};var wr=o.weekly_report||{};
panel.innerHTML='<h2 class="section-title">Ce qui demande une action</h2><div class="adm-cards">'
+card(o.pending_reports,"signalements en attente",o.pending_reports>0?'<a href="#" data-go="reports">Les traiter</a>':"Rien à traiter.",o.pending_reports>0)
+card(o.pending_contacts,"messages de contact en attente",o.pending_contacts>0?'<a href="#" data-go="contact">Les lire</a>':"Rien à lire.",o.pending_contacts>0)
+card(o.emails_failed,"e-mails en échec",o.emails_failed>0?'<a href="#" data-go="emails">Voir et relancer</a>':"Tous les envois passent.",o.emails_failed>0)
+card(o.accounts_without_profile,"comptes sans profil","Inscrits qui n’ont pas encore rempli leur profil.")
+card(o.unconfirmed,"adresses non confirmées","Comptes dont l’e-mail n’a pas été validé.")
+"</div>"
+'<h2 class="section-title">Les sept derniers jours</h2><div class="adm-cards">'
+card(w.members_new,"nouveaux membres",n(w.persons_new)+" personnes, "+n(w.institutions_new)+" institutions")
+card(Number(w.projects_new||0)+Number(w.calls_new||0),"projets et appels publiés",n(w.calls_new)+" appels d’institutions")
+card(w.applications_new,"candidatures",n(w.applications_accepted)+" acceptées")
+card(Number(w.messages_private||0)+Number(w.messages_team||0),"messages",n(w.messages_private)+" privés, "+n(w.messages_team)+" d’équipe")
+card(w.document_saves,"enregistrements de documents",n(w.active_spaces)+" espaces actifs")
+card(o.reports_7d,"signalements reçus","")
+"</div>"
+'<h2 class="section-title">État du site</h2><div class="adm-cards">'
+card(o.accounts,"comptes",n(o.profiles)+" profils complétés, dont "+n(o.institutions)+" institutions")
+card(o.open_projects,"projets ouverts","")
+card(o.certificates,"attestations valides","")
+card(o.suspended,"comptes suspendus",o.suspended>0?'<a href="#" data-go="members">Voir les membres</a>':"")
+card(o.hidden,"contenus masqués",o.hidden>0?'<a href="#" data-go="hidden">Voir la liste</a>':"")
+card(o.emails_sent_7d,"e-mails envoyés en 7 jours",n(o.emails_waiting)+" en attente d’envoi")
+card(o.errors_7d,"erreurs dans le navigateur",Number(o.errors_7d||0)>0?'<a href="#" data-go="errors">Les regarder</a>':"Aucune ces sept derniers jours.",Number(o.errors_7d||0)>0)
+"</div>"
+'<div class="id-card"><strong>Rapport du lundi</strong><p class="adm-small">Envoyé chaque lundi à 8 h, heure de Paris, à ton adresse. '+(wr.enabled?'<span class="adm-tag green">activé</span>':'<span class="adm-tag red">coupé</span>')+(wr.last_week_sent?" Dernier envoi : semaine du "+day(wr.last_week_sent)+".":" Aucun envoi pour l’instant.")+'</p><div class="adm-actions"><button class="btn secondary small" id="adm-weekly">'+(wr.enabled?"Couper le rapport":"Réactiver le rapport")+"</button></div></div>";
panel.innerHTML+=infraHtml();
document.getElementById("adm-sauvegarde").addEventListener("click",async function(){
var b=this,etat=document.getElementById("adm-sauvegarde-etat");
b.disabled=true;etat.textContent="Pr\u00e9paration\u2026";
try{
var d=await call("admin_export_donnees");
var txt=JSON.stringify(d,null,1);
var jour=new Date().toLocaleDateString("sv-SE");
var a=document.createElement("a");
a.href=URL.createObjectURL(new Blob([txt],{type:"application/json"}));
a.download="polymatch-sauvegarde-"+jour+".json";
document.body.appendChild(a);a.click();a.remove();
setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
etat.textContent=n(d.lignes_exportees)+" lignes, "+Math.max(1,Math.round(txt.length/1024))+" Ko";
}catch(e){etat.textContent="\u00c9chec de l\u2019export.";}
b.disabled=false;});
document.getElementById("adm-weekly").addEventListener("click",async function(){await call("admin_set_weekly_report",{p_enabled:!wr.enabled});say(wr.enabled?"Rapport hebdomadaire coupé.":"Rapport hebdomadaire réactivé.");renderOverview();});
bindGo();updateCount(o.pending_reports);updateContactCount(o.pending_contacts);updateErrorCount(o.errors_7d);}
function bindGo(){panel.querySelectorAll("[data-go]").forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();show(a.getAttribute("data-go"));});});}
function updateCount(k){var c=document.getElementById("adm-count");c.textContent=k>0?String(k):"";}
function updateContactCount(k){var c=document.getElementById("adm-ccount");if(c)c.textContent=k>0?String(k):"";}
function updateErrorCount(k){var c=document.getElementById("adm-ecount");if(c)c.textContent=k>0?String(k):"";}

// ---------------------------------------------------------------- signalements
var reportStatus="pending";
function targetHtml(t,kind){
if(!t||!t.exists)return '<p class="adm-small"><em>Ce contenu n’existe plus : son auteur l’a probablement supprimé.</em></p>';
var author=t.author_id?'<a class="author-link" href="profil-public.html?id='+E(t.author_id)+'" target="_blank" rel="noopener">'+E(t.author_name||"membre sans profil")+"</a>":"inconnu";
return '<div class="adm-small">'+E(t.context||KIND[kind]||kind)+" · auteur : "+author+" · publié le "+day(t.created_at)+(t.hidden?' · <span class="adm-tag red">masqué</span>':"")+(t.link&&!t.hidden?' · <a href="'+E(t.link)+'" target="_blank" rel="noopener">voir sur le site</a>':"")+"</div>"
+'<div class="adm-quote">'+(t.title?"<strong>"+E(t.title)+"</strong>\n":"")+E(t.text||"(sans texte)")+"</div>";}
async function renderReports(){
loading();
var rows=await call("admin_reports",{p_status:reportStatus,p_limit:200});
var head='<div class="adm-tools"><select id="adm-rstatus"><option value="pending"'+(reportStatus==="pending"?" selected":"")+'>En attente</option><option value="handled"'+(reportStatus==="handled"?" selected":"")+'>Déjà traités</option><option value="all"'+(reportStatus==="all"?" selected":"")+'>Tous</option></select><span class="adm-small">'+n(rows.length)+" signalement"+(rows.length>1?"s":"")+"</span></div>"
+'<p class="field-hint">Masquer un contenu le retire du site pour tout le monde sauf toi. Il reste conservé, et peut être rétabli depuis l’onglet « Contenus masqués ». Tous les signalements sur un même contenu sont clos par la même décision.</p>';
if(!rows.length){panel.innerHTML=head+'<p class="empty-note">'+(reportStatus==="pending"?"Aucun signalement en attente.":"Aucun signalement.")+"</p>";bindStatus();return;}
panel.innerHTML=head+rows.map(function(r){
var t=r.target||{};var pending=!r.handled_at;
return '<div class="adm-item'+(pending?" pending":"")+'" data-id="'+E(r.id)+'"><div class="adm-head"><strong>'+E(KIND[r.kind]||r.kind)+"</strong><span>signalé le "+fmt(r.created_at)+" par "+E(r.reporter_name||"un membre")+"</span>"+(r.same_target>1?'<span class="adm-tag red">'+n(r.same_target)+" signalements sur ce contenu</span>":"")+(r.author_suspended?'<span class="adm-tag red">auteur suspendu</span>':"")+"</div>"
+'<p class="adm-small" style="margin-top:8px;"><strong>Motif donné :</strong> '+E(r.reason||"aucun motif")+"</p>"
+targetHtml(t,r.kind)
+(pending
 ?'<div class="adm-actions"><textarea placeholder="Note interne, facultative : ce qui justifie la décision."></textarea>'
  +'<button class="btn secondary small" data-act="dismiss">Classer sans suite</button>'
  +(t.exists?'<button class="btn accent small" data-act="hide">Masquer le contenu</button><button class="btn danger small" data-act="hide_suspend">Masquer et suspendre l’auteur</button>':"")
  +(t.exists&&t.author_id?'<button class="btn secondary small" data-act="warn" data-user="'+E(t.author_id)+'">Avertir l’auteur</button>':"")
  +"</div>"
 :'<p class="adm-small" style="margin-top:8px;"><span class="adm-tag '+(r.decision==="dismiss"?"":"red")+'">'+E(DECISION[r.decision]||r.decision||"traité")+"</span> le "+fmt(r.handled_at)+(r.note?" · note : "+E(r.note):"")+"</p>")
+"</div>";}).join("");
bindStatus();
panel.querySelectorAll(".adm-item [data-act]").forEach(function(b){b.addEventListener("click",async function(){
var box=b.closest(".adm-item");var id=box.getAttribute("data-id");var note=(box.querySelector("textarea")||{}).value||"";var act=b.getAttribute("data-act");
if(act==="warn"){var txt=ask("Message d’avertissement envoyé à l’auteur par la messagerie (il recevra aussi un e-mail) :",true);if(!txt)return;await call("admin_warn",{p_user:b.getAttribute("data-user"),p_text:txt,p_report:id});say("Avertissement envoyé.");return;}
if(act==="hide_suspend"&&!confirm("Masquer ce contenu et suspendre son auteur ? Il ne pourra plus rien publier tant que tu ne l’auras pas réintégré."))return;
b.disabled=true;
try{await call("admin_decide_report",{p_report:id,p_decision:act,p_note:note.trim()||null});}catch(e){b.disabled=false;return;}
say(DECISION[act]+".");renderReports();refreshCount();});});}
function bindStatus(){var s=document.getElementById("adm-rstatus");if(s)s.addEventListener("change",function(){reportStatus=s.value;renderReports();});}
async function refreshCount(){try{var o=await call("admin_overview");updateCount(o.pending_reports);}catch(e){}}
