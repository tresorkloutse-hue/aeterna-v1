// Polymatch : droits RGPD depuis la page profil. Telecharger ses donnees, supprimer son compte.
// Le fichier s ajoute a profil.html et construit sa propre carte, pour ne pas alourdir la page.
(function(){
function el(id){return document.getElementById(id);}
function T(s){return typeof pmT==="function"?pmT(s):s;}
function nfr(v){return Number(v||0).toLocaleString("fr-FR");}
function ligne(n,mot,motPluriel){return nfr(n)+" "+(Math.abs(Number(n||0))>1?(motPluriel||mot+"s"):mot);}

function carte(){
var apres=el("pm-notif-card");if(!apres||el("pm-data-card"))return null;
var d=document.createElement("div");
d.className="id-card";d.id="pm-data-card";d.style.marginTop="18px";
d.innerHTML='<h3 style="margin:0 0 12px;">Vos donn\u00e9es</h3>'
+'<p class="field-hint" style="margin-top:0;">Deux droits exer\u00e7ables ici, sans rien demander \u00e0 personne. Le d\u00e9tail de ce qui est conserv\u00e9 figure dans la <a href="confidentialite.html">politique de confidentialit\u00e9</a>.</p>'
+'<div class="cta-row left" style="margin:14px 0 0;"><button type="button" class="btn secondary" id="pm-export">T\u00e9l\u00e9charger mes donn\u00e9es</button><button type="button" class="btn secondary" id="pm-del-open" style="color:#8f2d1c;border-color:#8f2d1c;">Supprimer mon compte</button></div>'
+'<p class="field-hint" id="pm-data-state" style="margin:12px 0 0;"></p>'
+'<div id="pm-del-zone" style="display:none;margin-top:16px;border-top:1px solid var(--line);padding-top:16px;"></div>';
apres.parentNode.insertBefore(d,apres.nextSibling);
return d;
}

function dire(texte){var s=el("pm-data-state");if(s)s.textContent=texte;}

async function exporter(){
var b=el("pm-export");b.disabled=true;dire(T("Pr\u00e9paration du fichier\u2026"));
try{
var r=await client.rpc("my_data_export");
if(r.error)throw new Error(r.error.message);
var texte=JSON.stringify(r.data,null,2);
var url=URL.createObjectURL(new Blob([texte],{type:"application/json;charset=utf-8"}));
var a=document.createElement("a");
a.href=url;a.download="polymatch-mes-donnees-"+new Date().toISOString().slice(0,10)+".json";
document.body.appendChild(a);a.click();document.body.removeChild(a);
setTimeout(function(){URL.revokeObjectURL(url);},4000);
dire(T("Fichier t\u00e9l\u00e9charg\u00e9. Il contient profil, projets, candidatures, messages, documents, ouvertures et attestations."));
}catch(e){dire(T("Le fichier n\u2019a pas pu \u00eatre pr\u00e9par\u00e9. R\u00e9essayer dans un instant."));}
finally{b.disabled=false;}
}

async function ouvrirSuppression(){
var zone=el("pm-del-zone");if(zone.style.display==="block"){zone.style.display="none";return;}
zone.style.display="block";zone.innerHTML='<p class="field-hint">'+T("Chargement\u2026")+"</p>";
var r=await client.rpc("my_deletion_preview");
if(r.error){zone.innerHTML='<p class="field-hint">'+T("Le r\u00e9capitulatif n\u2019a pas pu \u00eatre charg\u00e9.")+"</p>";return;}
var s=r.data.supprime||{},k=r.data.conserve_sans_votre_nom||{};
var part=[ligne(s.documents_personnels,"document personnel","documents personnels"),ligne(s.messages_prives,"message priv\u00e9","messages priv\u00e9s"),ligne(s.candidatures,"candidature"),ligne(s.signalements_envoyes,"signalement envoy\u00e9","signalements envoy\u00e9s")];
var reste=[ligne(k.projets_portes,"projet port\u00e9","projets port\u00e9s"),ligne(k.documents_partages,"document partag\u00e9","documents partag\u00e9s"),ligne(k.messages_equipe,"message d\u2019\u00e9quipe","messages d\u2019\u00e9quipe"),ligne(k.ouvertures,"ouverture"),ligne(k.attestations,"attestation")];
zone.innerHTML='<h4 style="margin:0 0 10px;color:#8f2d1c;">'+T("Suppression d\u00e9finitive")+"</h4>"
+'<p class="field-hint" style="margin-top:0;"><strong>'+T("Effac\u00e9 imm\u00e9diatement :")+"</strong> "+pmEscape(part.join(", "))+", "+T("ainsi que votre profil et votre adresse e-mail.")+"</p>"
+'<p class="field-hint"><strong>'+T("Conserv\u00e9, sans votre nom :")+"</strong> "+pmEscape(reste.join(", "))+". "+T("Le travail commun et les attestations engagent aussi les autres : ils restent en place, votre nom en est retir\u00e9.")+"</p>"
+'<p class="field-hint">'+T("Cette action est irr\u00e9versible. Pour confirmer, \u00e9crire SUPPRIMER ci-dessous.")+"</p>"
+'<input type="text" id="pm-del-word" autocomplete="off" placeholder="SUPPRIMER" style="max-width:220px;">'
+'<div class="cta-row left" style="margin:12px 0 0;"><button type="button" class="btn" id="pm-del-go" style="background:#8f2d1c;border-color:#8f2d1c;">'+T("Supprimer d\u00e9finitivement")+'</button><button type="button" class="btn secondary" id="pm-del-cancel">'+T("Annuler")+"</button></div>"
+'<p class="field-hint" id="pm-del-state" style="margin-bottom:0;"></p>';
el("pm-del-cancel").addEventListener("click",function(){zone.style.display="none";});
el("pm-del-go").addEventListener("click",supprimer);
}

async function supprimer(){
var etat=el("pm-del-state");var mot=(el("pm-del-word").value||"").trim().toUpperCase();
if(mot!=="SUPPRIMER"){etat.textContent=T("\u00c9crire SUPPRIMER pour confirmer.");return;}
if(!confirm(T("Supprimer d\u00e9finitivement ce compte ? Cette action ne peut pas \u00eatre annul\u00e9e.")))return;
var b=el("pm-del-go");b.disabled=true;etat.textContent=T("Suppression en cours\u2026");
try{
var r=await client.functions.invoke("delete-account",{body:{confirmation:"SUPPRIMER"}});
if(r.error){var m="";try{var j=await r.error.context.json();m=j&&j.error;}catch(x){}throw new Error(m||"");}
try{await client.auth.signOut();}catch(x){}
alert(T("Compte supprim\u00e9. Merci d\u2019avoir \u00e9t\u00e9 l\u00e0."));
window.location.href="index.html";
}catch(e){b.disabled=false;etat.textContent=T("La suppression n\u2019a pas abouti. R\u00e9essayer dans un instant, ou \u00e9crire \u00e0 polymatch.contact@gmail.com.");}
}

async function demarrer(){
var s=await pmGetSession();if(!s)return;
var d=carte();if(!d)return;
el("pm-export").addEventListener("click",exporter);
el("pm-del-open").addEventListener("click",ouvrirSuppression);
if(typeof pmTranslateDom==="function")pmTranslateDom(d);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(demarrer,400);});
else setTimeout(demarrer,400);
})();
