const SUPABASE_URL="https://ytpzbhlsjvkapqdmkiyi.supabase.co";const SUPABASE_KEY="sb_publishable_o4XdstRZx81jr3IMl9oqjQ_J2IQHKU3";const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
// Journal des erreurs du navigateur. Une erreur de script qui casse une page passe
// inapercue : personne n ecrit pour la signaler, on change simplement de site. Elle
// est donc deposee en base et lue depuis la page de moderation. Rien de personnel n
// est envoye : le chemin de la page, le message, la pile d appel, une etiquette de
// navigateur grossiere. Au plus cinq envois par page vue, jamais deux fois le meme.
// La version du script accompagne chaque erreur. Sans elle, impossible de
// distinguer un vrai defaut d une copie en cache datant d avant le correctif.
var PM_VER="2026-09-27";
var PM_ERR_N=0;var PM_ERR_VUES={};
function pmNavigateur(){var u=String(navigator.userAgent||"");
var nom=/Edg\//.test(u)?"Edge":/OPR\//.test(u)?"Opera":/Firefox\//.test(u)?"Firefox":/Chrome\//.test(u)?"Chrome":/Safari\//.test(u)?"Safari":"autre";
var v=(u.match(/(?:Edg|OPR|Firefox|Chrome|Version)\/(\d+)/)||[])[1]||"";
var sys=/Windows/.test(u)?"Windows":/Android/.test(u)?"Android":/iPhone|iPad|iPod/.test(u)?"iOS":/Mac OS X/.test(u)?"macOS":/Linux/.test(u)?"Linux":"autre";
return nom+(v?" "+v:"")+" / "+sys+" \u00b7 v"+PM_VER;}
function pmTierce(url){try{return new URL(String(url),location.href).origin!==location.origin;}catch(e){return false;}}
function pmSignalerErreur(genre,message,pile){try{
if(!message||PM_ERR_N>=5)return;
var cle=genre+"|"+message;if(PM_ERR_VUES[cle])return;PM_ERR_VUES[cle]=true;PM_ERR_N++;
// le then est indispensable : sans lui, supabase-js ne part jamais en requete
client.rpc("pm_log_client_error",{p_kind:genre,p_page:String(location.pathname).slice(0,120),p_message:String(message).slice(0,300),p_stack:pile?String(pile).slice(0,1500):null,p_browser:pmNavigateur()}).then(function(){},function(){});
}catch(e){}}
window.addEventListener("error",function(e){
if(e&&e.target&&e.target!==window&&e.target.tagName){var t=e.target.tagName;
// Les images ne sont plus consignees : elles ne cassent aucune page, et ces
// echecs viennent des clients qui les refusent, pas du site. Une image
// reellement manquante se voit a la comparaison entre le depot et la production.
if(t==="SCRIPT"||t==="LINK"){var src=String(e.target.src||e.target.href||"");
if(e.target.getAttribute&&e.target.getAttribute("data-pm-silencieux"))return;
// une ressource d un autre domaine qui tombe ne vient pas de nous : traducteur, extension, reseau du visiteur
if(!pmTierce(src))pmSignalerErreur("ressource","Chargement impossible : "+src.split("?")[0],null);}
return;}
var m=e&&e.message?String(e.message):"";
if(!m||m==="Script error.")return;
pmSignalerErreur("erreur",m+(e.filename?" ("+String(e.filename).split("/").pop()+":"+e.lineno+")":""),e.error&&e.error.stack);},true);
window.addEventListener("unhandledrejection",function(e){var r=e&&e.reason;
var m=r&&r.message?String(r.message):String(r||"");
if(!m||m==="undefined")return;
// le site n evalue jamais de chaine : un refus lie a unsafe-eval vient toujours d un outil exterieur
if(m.indexOf("unsafe-eval")!==-1)return;
pmSignalerErreur("promesse",m,r&&r.stack);});
const PM_SEAL='<a class="seal" href="index.html"><span class="r-top"></span><span class="name">POLYMATCH</span><span class="sub-mark">INTERDISCIPLINAIRE</span><span class="r-bot"></span></a>';
// Si la base est injoignable, ces deux appels rejetaient, pmInitNav s arretait,
// et la page restait sans menu ni pied de page. On degrade en visiteur non
// connecte : le site reste navigable, ce qui vaut mieux qu une page orpheline.
async function pmGetSession(){try{const{data}=await client.auth.getSession();return (data&&data.session)||null;}catch(e){return null;}}
async function pmGetProfile(userId){try{const{data,error}=await client.from("profiles").select("*").eq("id",userId).maybeSingle();if(error){console.error(error);return null;}return data;}catch(e){return null;}}
function pmEscape(str){if(str===null||str===undefined)return "";return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function pmInitials(name){var parts=String(name||"").trim().split(/\s+/).filter(Boolean);if(parts.length===0)return "?";if(parts.length===1)return parts[0].slice(0,2).toUpperCase();return (parts[0].charAt(0)+parts[parts.length-1].charAt(0)).toUpperCase();}
function pmAvatar(name,size,isOrg){return '<span class="avatar'+(size==="big"?" big":"")+(isOrg?" org":"")+'" aria-hidden="true">'+pmEscape(pmInitials(name))+"</span>";}
function pmAuthorLink(id,name,fallback){var n=pmEscape(name||fallback||"quelqu'un");return id?'<a class="author-link" href="profil-public.html?id='+id+'">'+n+"</a>":n;}
const PM_FRAMEWORK={stage:"Stage",these:"Thèse",mission:"Mission",benevolat:"Bénévolat",autre:"Autre cadre"};
const PM_COMPENSATION={remunere:"Rémunéré",indemnise:"Indemnisé",benevole:"Bénévole"};
const PM_ORG_KIND={universite:"Université",laboratoire:"Laboratoire",ecole:"École",association:"Association",entreprise:"Entreprise",collectivite:"Collectivité",autre:"Structure"};
function pmIsOrg(x){return !!x&&x.account_type==="institution";}
let PM_ME=null;
function pmFormal(){return pmIsOrg(PM_ME);}
function pmV(tu,vous){return pmT(pmFormal()?vous:tu);}
function pmOrgKind(k){return pmT(PM_ORG_KIND[k]||k||"Structure");}
function pmLocale(){var l=pmLang();return l==="fr"?"fr-FR":l==="en"?"en-GB":l==="es"?"es-ES":l==="pt"?"pt-PT":"ar";}
function pmDeadlineInfo(d){if(!d)return null;var t=new Date(d+"T12:00:00");var days=Math.ceil((t-Date.now())/86400000);var txt=t.toLocaleDateString(pmLocale(),{day:"numeric",month:"long",year:"numeric"});if(days<0)return{text:pmT("Candidatures closes depuis le {d}").replace("{d}",txt),urgent:true};if(days===0)return{text:pmT("Candidatures closes ce soir"),urgent:true};if(days<=7)return{text:pmT(days>1?"Candidatures jusqu’au {d} (plus que {n} jours)":"Candidatures jusqu’au {d} (plus que {n} jour)").replace("{d}",txt).replace("{n}",days),urgent:true};return{text:pmT("Candidatures jusqu’au {d}").replace("{d}",txt),urgent:false};}
function pmInstFacts(p){if(!p||p.owner_type!=="institution")return "";var out=[];if(p.framework)out.push(pmT(PM_FRAMEWORK[p.framework]||p.framework));if(p.places)out.push(p.places>1?pmT("{n} places").replace("{n}",p.places):pmT("1 place"));if(p.compensation)out.push(pmT(PM_COMPENSATION[p.compensation]||p.compensation));var dl=pmDeadlineInfo(p.deadline);if(dl)out.push({t:dl.text,u:dl.urgent});if(out.length===0)return "";return '<div class="inst-facts">'+out.map(function(o){return typeof o==="string"?"<span>"+pmEscape(o)+"</span>":'<span class="'+(o.u?"urgent":"")+'">'+pmEscape(o.t)+"</span>";}).join("")+"</div>";}
function pmReportLink(kind,id){return '<a href="#" class="report-link" data-report-kind="'+kind+'" data-report-id="'+id+'">Signaler</a>';}
function pmBindReports(root){(root||document).querySelectorAll("[data-report-kind]").forEach(function(a){if(a.getAttribute("data-pm-bound"))return;a.setAttribute("data-pm-bound","1");a.addEventListener("click",async function(e){e.preventDefault();var s=await pmGetSession();if(!s){alert(pmT("Connecte-toi pour signaler un contenu."));return;}var reason=prompt(pmT("Que signales-tu ? Décris le problème en une phrase."));if(reason===null)return;var r=await client.from("reports").insert({reporter_id:s.user.id,target_kind:a.getAttribute("data-report-kind"),target_id:a.getAttribute("data-report-id"),reason:(reason||"").trim()||null});if(r.error){alert(r.error.message);return;}a.removeAttribute("href");a.className="report-done";a.textContent=pmT("Signalé, merci");});});}
function pmFormatDate(iso){try{const d=new Date(iso);return d.toLocaleDateString(pmLocale(),{day:"numeric",month:"short",year:"numeric"});}catch(e){return "";}}
function pmRelativeTime(iso){try{var d=new Date(iso);var s=(Date.now()-d.getTime())/1000;if(s<60)return pmT("à l’instant");if(s<3600)return pmT("il y a {n} min").replace("{n}",Math.floor(s/60));if(s<86400)return pmT("il y a {n} h").replace("{n}",Math.floor(s/3600));if(s<172800)return pmT("hier");if(s<604800)return pmT("il y a {n} jours").replace("{n}",Math.floor(s/86400));return pmFormatDate(iso);}catch(e){return "";}}
async function pmUnreadCount(userId){try{var r=await client.from("messages").select("id",{count:"exact",head:true}).eq("recipient_id",userId).is("read_at",null);return r.error?0:(r.count||0);}catch(e){return 0;}}
function pmSetUnreadBadge(n){var b=document.getElementById("pm-unread-badge");if(!b)return;if(n>0){b.textContent=n>99?"99+":String(n);b.style.display="inline-flex";}else{b.textContent="";b.style.display="none";}}
async function pmRefreshUnreadBadge(userId){pmSetUnreadBadge(await pmUnreadCount(userId));}
function pmShowMessage(el,text,type){if(!el)return;el.textContent=text;el.className="msg-box "+(type||"error");el.style.display=text?"block":"none";}
const PM_LANGS={fr:"Français",en:"English",es:"Español",pt:"Português",ar:"العربية"};
const PM_RTL=["ar"];
let PM_DICT=null;
function pmLang(){try{var q=new URLSearchParams(window.location.search).get("lang");if(q&&PM_LANGS[q]){try{localStorage.setItem("pm-lang",q);}catch(e){}return q;}var s=localStorage.getItem("pm-lang");if(s&&PM_LANGS[s])return s;}catch(e){}try{var n=String(navigator.language||"fr").slice(0,2).toLowerCase();if(PM_LANGS[n])return n;}catch(e){}return "fr";}
function pmNorm(s){return String(s).replace(/\s+/g," ").trim();}
function pmHash(s){var h=5381;for(var i=0;i<s.length;i++){h=((h<<5)+h+s.charCodeAt(i))|0;}return (h>>>0).toString(36);}
function pmTr(s){if(!PM_DICT)return null;var k=pmNorm(s);if(!k)return null;var v=PM_DICT[pmHash(k)];return (v===undefined||v==="")?null:v;}
function pmT(fr){var v=pmTr(fr);return v===null?fr:v;}
function pmTranslateNode(node){
if(!node)return;
if(node.nodeType===3){var raw=node.nodeValue;var v=pmTr(raw);if(v!==null){var lead=raw.match(/^\s*/)[0];var trail=raw.match(/\s*$/)[0];node.nodeValue=lead+v+trail;}return;}
if(node.nodeType!==1)return;
var tag=node.tagName;
if(tag==="SCRIPT"||tag==="STYLE")return;
["placeholder","title","alt","aria-label"].forEach(function(a){if(node.hasAttribute(a)){var v=pmTr(node.getAttribute(a));if(v!==null)node.setAttribute(a,v);}});
for(var c=node.firstChild;c;c=c.nextSibling)pmTranslateNode(c);
}
function pmTranslateDom(root){if(!PM_DICT)return;pmTranslateNode(root||document.body);var t=pmTr(document.title);if(t!==null)document.title=t;}
let pmObserver=null;
function pmObserveI18n(){if(!PM_DICT||pmObserver||typeof MutationObserver==="undefined")return;pmObserver=new MutationObserver(function(muts){for(var i=0;i<muts.length;i++){var added=muts[i].addedNodes;for(var j=0;j<added.length;j++)pmTranslateNode(added[j]);}});pmObserver.observe(document.body,{childList:true,subtree:true});}
function pmLoadScript(src,integrity){return new Promise(function(done){var s=document.createElement("script");if(integrity){s.integrity=integrity;s.crossOrigin="anonymous";}
// ce chargeur a son propre reessai : le journal ne doit pas consigner un
// echec avant de savoir si le second essai le rattrape
s.setAttribute("data-pm-silencieux","1");
s.src=src;s.onload=function(){done(true);};s.onerror=function(){done(false);};document.head.appendChild(s);});}
// un seul echec reseau suffisait a laisser la page a moitie traduite : on reessaie
async function pmCharger(src){
if(await pmLoadScript(src))return true;
if(await pmLoadScript(src+"?r=1"))return true;
// deux echecs de suite : la, c est une vraie panne, elle merite le journal
pmSignalerErreur("ressource","Dictionnaire indisponible apres deux essais : "+src,null);
return false;}
async function pmLoadDict(){
var l=pmLang();
document.documentElement.setAttribute("lang",l);
document.documentElement.setAttribute("dir",PM_RTL.indexOf(l)!==-1?"rtl":"ltr");
if(l==="fr"){PM_DICT=null;return l;}
if(!window.PM_I18N){
if(!await pmCharger("i18n-"+l+".js")){
// sans la premiere partie, tout melange serait pire que le francais seul
document.documentElement.setAttribute("lang","fr");document.documentElement.setAttribute("dir","ltr");PM_DICT=null;return "fr";}
for(var p=2;p<=5;p++){await pmCharger("i18n-"+l+"-"+p+".js");}}
PM_DICT=window.PM_I18N||null;
return l;
}
function pmLangSelectHtml(cur){var o=Object.keys(PM_LANGS).map(function(k){return '<option value="'+k+'"'+(k===cur?" selected":"")+">"+PM_LANGS[k]+"</option>";}).join("");return '<select class="lang-select" id="pm-lang-select" aria-label="Langue du site" title="Langue du site">'+o+"</select>";}
function pmBindLangSelect(){var el=document.getElementById("pm-lang-select");if(!el)return;el.addEventListener("change",function(){var v=el.value;try{localStorage.setItem("pm-lang",v);}catch(e){}var u=new URL(window.location.href);u.searchParams.set("lang",v);window.location.href=u.toString();});}
function pmNavHtml(session){if(session){return '<a href="manifeste.html">Philosophie</a>'+'<a href="projets.html">Projets</a>'+'<a href="ouvertures.html">Ouvertures</a>'+'<a href="membres.html">Membres</a>'+'<a href="espace.html">Espace</a>'+'<a href="messagerie.html">Messages<span id="pm-unread-badge" class="nav-badge" style="display:none;"></span></a>'+'<a href="collaborations.html">Collaborations</a>'+'<a href="profil.html">Mon profil</a>'+'<a href="#" id="pm-logout">Se déconnecter</a>';}return '<a href="manifeste.html">Philosophie</a>'+'<a href="projets.html">Projets</a>'+'<a href="ouvertures.html">Ouvertures</a>'+'<a href="verifier.html">Vérifier une attestation</a>'+'<a href="connexion.html">Se connecter</a>';}
function pmFooterHtml(){return '<div class="footer-inner"><div><a href="manifeste.html">Notre philosophie</a><a href="textes.html">Textes</a><a href="projets.html">Projets</a><a href="ouvertures.html">Ouvertures</a><a href="verifier.html">Vérifier une attestation</a></div><div><a href="contact.html">Contact</a><a href="mentions-legales.html">Mentions légales</a><a href="confidentialite.html">Confidentialité</a><a href="conditions.html">Conditions d’utilisation</a></div><div>Polymatch, la mise en relation interdisciplinaire entre étudiants et chercheurs.</div></div>';}
function pmExtraCss(){if(document.getElementById("pm-extra-css"))return;var l=document.createElement("link");l.id="pm-extra-css";l.rel="stylesheet";l.href="outils/pm-extra.css";document.head.appendChild(l);}
function pmBindNavToggle(){var b=document.getElementById("pm-nav-toggle");var inner=b?b.parentNode:null;if(!b||!inner)return;
inner.classList.add("nav-has-toggle");
b.addEventListener("click",function(){var ouvert=inner.classList.toggle("nav-open");b.setAttribute("aria-expanded",ouvert?"true":"false");b.setAttribute("aria-label",pmT(ouvert?"Fermer le menu":"Ouvrir le menu"));b.textContent=ouvert?"✕":"☰";});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&inner.classList.contains("nav-open"))b.click();});}
async function pmInitNav(currentPage){pmExtraCss();const lang=await pmLoadDict();const session=await pmGetSession();if(session){PM_ME=await pmGetProfile(session.user.id);}const navHost=document.getElementById("pm-nav");if(navHost){navHost.className="nav";navHost.innerHTML='<div class="nav-inner">'+PM_SEAL+'<button type="button" class="nav-toggle" id="pm-nav-toggle" aria-expanded="false" aria-controls="site-nav-auth" aria-label="Ouvrir le menu">☰</button><nav class="links" id="site-nav-auth"></nav></div>';}const nav=document.getElementById("site-nav-auth");if(nav){nav.innerHTML=pmNavHtml(session)+pmLangSelectHtml(lang);const logout=document.getElementById("pm-logout");if(logout){logout.addEventListener("click",async(e)=>{e.preventDefault();await client.auth.signOut();window.location.href="index.html";});}if(currentPage){nav.querySelectorAll("a").forEach((a)=>{if(a.getAttribute("href")===currentPage)a.classList.add("current");});}}const foot=document.getElementById("pm-footer");if(foot){foot.className="footer";foot.innerHTML=pmFooterHtml();}pmBindNavToggle();pmTranslateDom(document.body);pmObserveI18n();pmBindLangSelect();if(session){pmRefreshUnreadBadge(session.user.id);pmAdminLink(currentPage);}return session;}
function pmAdminLink(currentPage){client.rpc("pm_is_admin").then(function(r){if(!r||r.data!==true)return;var nav=document.getElementById("site-nav-auth");if(!nav||nav.querySelector('a[href="moderation.html"]'))return;var a=document.createElement("a");a.href="moderation.html";a.textContent="Modération";if(currentPage==="moderation.html")a.classList.add("current");var lo=document.getElementById("pm-logout");if(lo)nav.insertBefore(a,lo);else nav.appendChild(a);},function(){});}
async function pmAiAssist(action,text){const{data,error}=await client.functions.invoke("ai-assist",{body:{action:action,text:text}});if(error){let message=pmT("L'assistant IA n'a pas pu répondre, réessaie dans un instant.");try{if(error.context&&typeof error.context.json==="function"){const body=await error.context.json();if(body&&body.error)message=body.error;}}catch(e){}throw new Error(message);}if(data&&data.error){throw new Error(data.error);}return data?data.result:null;}
async function pmRequireSession(redirectTo){const session=await pmGetSession();if(!session){const target=redirectTo||window.location.pathname.split("/").pop();window.location.href="connexion.html?next="+encodeURIComponent(target);return null;}return session;}
