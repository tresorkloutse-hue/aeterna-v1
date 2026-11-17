// Polymatch : outils de l espace de travail (feuille de calcul, Word, Excel, PowerPoint).
// Charge par espace.html juste apres app.js. Les fonctions appelees ici (renderSheet, markDirty...) sont definies par la page.
// --- moteur de calcul de la feuille : sans eval, formules a la francaise ou a l anglaise
var PM_FN={SOMME:"SUM",SUM:"SUM",MOYENNE:"AVERAGE",AVERAGE:"AVERAGE",MIN:"MIN",MAX:"MAX",NB:"COUNT",COUNT:"COUNT"};
function pmColName(c){var s="";c=c+1;while(c>0){var m=(c-1)%26;s=String.fromCharCode(65+m)+s;c=Math.floor((c-1)/26);}return s;}
function pmColIndex(s){var n=0;s=s.toUpperCase();for(var i=0;i<s.length;i++)n=n*26+(s.charCodeAt(i)-64);return n-1;}
function pmErr(code){var e=new Error(code);e.pmCode=code;return e;}
function pmParseNum(t){var s=String(t==null?"":t).replace(/[\s  ]/g,"");if(!s)return null;var pct=false;if(s.charAt(s.length-1)==="%"){pct=true;s=s.slice(0,-1);}if(!/^[-+]?\d+(?:[.,]\d+)?$/.test(s))return null;var v=parseFloat(s.replace(",","."));return pct?v/100:v;}
function pmTokens(src){
var t=[],i=0,s=String(src).replace(/\$/g,"");
while(i<s.length){
var ch=s.charAt(i);var rest=s.slice(i);var m;
if(/\s/.test(ch)){i++;continue;}
if(rest.slice(0,5).toUpperCase()==="#REF!")throw pmErr("#REF!");
m=/^\d+(?:[.,]\d+)?/.exec(rest);
if(m){t.push({k:"n",v:parseFloat(m[0].replace(",","."))});i+=m[0].length;continue;}
m=/^([A-Za-z]{1,3})(\d+)(?::([A-Za-z]{1,3})(\d+))?/.exec(rest);
if(m&&!/[A-Za-z0-9(]/.test(rest.charAt(m[0].length))){
var r1=parseInt(m[2],10)-1,c1=pmColIndex(m[1]);
if(r1<0)throw pmErr("#REF!");
if(m[3]===undefined){t.push({k:"r",r:r1,c:c1});}
else{var r2=parseInt(m[4],10)-1,c2=pmColIndex(m[3]);if(r2<0)throw pmErr("#REF!");t.push({k:"R",r1:Math.min(r1,r2),c1:Math.min(c1,c2),r2:Math.max(r1,r2),c2:Math.max(c1,c2)});}
i+=m[0].length;continue;}
m=/^[A-Za-z][A-Za-z0-9.]*/.exec(rest);
if(m){t.push({k:"f",v:m[0].toUpperCase()});i+=m[0].length;continue;}
if("+-*/^();,%".indexOf(ch)!==-1){t.push({k:ch});i++;continue;}
throw pmErr("#ERREUR!");}
return t;}
function pmAgg(fn,vals){
if(fn==="COUNT")return vals.length;
if(fn==="SUM"){var s=0;vals.forEach(function(v){s+=v;});return s;}
if(fn==="AVERAGE"){if(!vals.length)throw pmErr("#DIV/0!");var a=0;vals.forEach(function(v){a+=v;});return a/vals.length;}
if(!vals.length)return 0;
return fn==="MIN"?Math.min.apply(null,vals):Math.max.apply(null,vals);}
function pmEval(src,get,rows){
var tk=pmTokens(src),p=0;
function peek(){return tk[p];}
function isSep(x){return x&&(x.k===";"||x.k===",");}
function eat(k){var x=tk[p];if(!x||x.k!==k)throw pmErr("#ERREUR!");p++;return x;}
function num(v){if(v===null||v===undefined||v==="")return 0;if(typeof v==="number")return v;throw pmErr("#VALEUR!");}
function expr(){var v=term();while(peek()&&(peek().k==="+"||peek().k==="-")){var o=tk[p++].k;var r=term();v=o==="+"?v+r:v-r;}return v;}
function term(){var v=power();while(peek()&&(peek().k==="*"||peek().k==="/")){var o=tk[p++].k;var r=power();if(o==="*")v=v*r;else{if(r===0)throw pmErr("#DIV/0!");v=v/r;}}return v;}
function power(){var b=unary();if(peek()&&peek().k==="^"){p++;b=Math.pow(b,power());}return b;}
function unary(){if(peek()&&peek().k==="-"){p++;return -unary();}if(peek()&&peek().k==="+"){p++;return unary();}var v=primary();while(peek()&&peek().k==="%"){p++;v=v/100;}return v;}
function primary(){
var x=peek();if(!x)throw pmErr("#ERREUR!");
if(x.k==="n"){p++;return x.v;}
if(x.k==="r"){p++;return num(get(x.r,x.c));}
if(x.k==="R")throw pmErr("#VALEUR!");
if(x.k==="("){p++;var v=expr();eat(")");return v;}
if(x.k==="f"){
p++;var fn=PM_FN[x.v];if(!fn)throw pmErr("#NOM?");eat("(");var vals=[];
if(!(peek()&&peek().k===")")){
for(;;){
var a=peek(),nx=tk[p+1];var alone=!nx||isSep(nx)||nx.k===")";
if(a&&a.k==="R"&&alone){p++;var rMax=Math.min(a.r2,rows-1);for(var rr=a.r1;rr<=rMax;rr++){for(var cc=a.c1;cc<=a.c2;cc++){var cv=get(rr,cc);if(typeof cv==="number")vals.push(cv);}}}
else if(a&&a.k==="r"&&alone){p++;var sv=get(a.r,a.c);if(typeof sv==="number")vals.push(sv);}
else vals.push(expr());
if(isSep(peek())){p++;continue;}
break;}}
eat(")");
return pmAgg(fn,vals);}
throw pmErr("#ERREUR!");}
var out=expr();if(p<tk.length)throw pmErr("#ERREUR!");return out;}
function pmSheetEval(data){
var memo={},busy={};
function cell(r,c){
if(r<0||c<0||r>=data.length||!data[r]||c>=data[r].length)return null;
var key=r+":"+c;
if(Object.prototype.hasOwnProperty.call(memo,key)){var mm=memo[key];if(mm.err)throw pmErr(mm.err);return mm.v;}
var raw=String(data[r][c]==null?"":data[r][c]);
if(raw.charAt(0)!=="="){var n=pmParseNum(raw);var v=raw.trim()===""?null:(n===null?raw:n);memo[key]={v:v};return v;}
if(busy[key])throw pmErr("#CYCLE!");
busy[key]=true;
try{var val=pmEval(raw.slice(1),cell,data.length);if(typeof val!=="number"||!isFinite(val))throw pmErr("#NOMBRE!");memo[key]={v:val};return val;}
catch(e){var code=(e&&e.pmCode)||"#ERREUR!";memo[key]={err:code};throw pmErr(code);}
finally{delete busy[key];}}
return function(r,c){try{return {v:cell(r,c)};}catch(e){return {err:(e&&e.pmCode)||"#ERREUR!"};}};}
function pmFmt(v){if(v===null||v===undefined)return "";if(typeof v!=="number")return String(v);var l=pmLocale();if(l==="ar")l="ar-u-nu-latn";try{return v.toLocaleString(l,{maximumFractionDigits:6,useGrouping:false});}catch(e){return String(v);}}
// references decalees quand une ligne ou une colonne disparait, comme dans Excel
function pmShiftRefs(f,axis,idx){
return String(f).replace(/\$/g,"").replace(/([A-Za-z]{1,3})(\d+)(?::([A-Za-z]{1,3})(\d+))?(?![A-Za-z0-9(])/g,function(all,c1,r1,c2,r2,off,str){
var prev=off>0?str.charAt(off-1):"";if(/[A-Za-z0-9.#]/.test(prev))return all;
var a={c:pmColIndex(c1),r:parseInt(r1,10)-1};
if(c2===undefined){var v=axis==="r"?a.r:a.c;if(v===idx)return "#REF!";if(v>idx){if(axis==="r")a.r--;else a.c--;}return pmColName(a.c)+(a.r+1);}
var b={c:pmColIndex(c2),r:parseInt(r2,10)-1};
var k=axis==="r"?"r":"c",o=axis==="r"?"c":"r";
var lo=Math.min(a[k],b[k]),hi=Math.max(a[k],b[k]);
if(idx<lo){lo--;hi--;}else if(idx<=hi){hi--;if(hi<lo)return "#REF!";}
var A={},B={};A[k]=lo;B[k]=hi;A[o]=Math.min(a[o],b[o]);B[o]=Math.max(a[o],b[o]);
return pmColName(A.c)+(A.r+1)+":"+pmColName(B.c)+(B.r+1);});}
// passage vers et depuis la syntaxe Excel, jeton par jeton
function pmToExcelFormula(raw){
try{return pmTokens(String(raw).slice(1)).map(function(x){
if(x.k==="n")return String(x.v);
if(x.k==="r")return pmColName(x.c)+(x.r+1);
if(x.k==="R")return pmColName(x.c1)+(x.r1+1)+":"+pmColName(x.c2)+(x.r2+1);
if(x.k==="f")return PM_FN[x.v]||x.v;
if(x.k===";"||x.k===",")return ",";
return x.k;}).join("");}catch(e){return null;}}
function pmFromExcelFormula(f){
var s=String(f||"");
if(/["'!\[\]{}]/.test(s))return null;
var names=s.match(/[A-Za-z][A-Za-z0-9.]*(?=\s*\()/g)||[];
for(var i=0;i<names.length;i++){if(!PM_FN[names[i].toUpperCase()])return null;}
var ours="="+s.replace(/\$/g,"").replace(/,/g,";");
try{pmTokens(ours.slice(1));}catch(e){return null;}
if(typeof pmLang==="function"&&pmLang()==="fr"){var FR={SUM:"SOMME",AVERAGE:"MOYENNE",COUNT:"NB"};ours=ours.replace(/[A-Za-z][A-Za-z0-9.]*(?=\s*\()/g,function(n){return FR[n.toUpperCase()]||n;});}
return ours;}
var PM_XL_ERR={"#DIV/0!":7,"#VALEUR!":15,"#REF!":23,"#NOM?":29,"#NOMBRE!":36,"#CYCLE!":15,"#ERREUR!":15};
// --- Word, Excel, PowerPoint : bibliotheques chargées seulement au clic
const PM_LIBS={
mammoth:["https://cdn.jsdelivr.net/npm/mammoth@1.12.3/mammoth.browser.min.js","sha384-xqNXvcKbEqifokHcBnB0H32p+OQchhD/T/xJGWCMAW5fC0c0MBf9atO3weoPCT84"],
xlsx:["https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js","sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT"],
fflate:["https://cdn.jsdelivr.net/npm/fflate@0.8.3/umd/index.js","sha384-ETfVLWAUsU3zp3SpnQsPDbAyrF6jYv2w8aNYo6KtY2JuyxXhzYLOL7e0ATbLSIHP"],
pptx:["https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js","sha384-Cck14aA9cifjYolcnjebXRfWGkz5ltHMBiG4px/j8GS+xQcb7OhNQWZYyWjQ+UwQ"]};
async function pmNeed(key,ready){if(ready())return true;var l=PM_LIBS[key];await pmLoadScript(l[0],l[1]);return ready();}
function pmFileName(ext){var t=String((currentDoc&&currentDoc.title)||"document").replace(/[\\/:*?"<>|]+/g," ").replace(/\s+/g," ").trim().slice(0,60);return (t||"document")+"."+ext;}
function pmDownload(blob,name){var a=document.createElement("a");var u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(u);a.remove();},0);}
function setupOffice(kind){
var row=document.getElementById("pm-office-row");var hint=document.getElementById("pm-office-hint");
var imp=document.getElementById("pm-import");var exp=document.getElementById("pm-export");
row.style.display="flex";hint.style.display="block";
if(kind==="doc"){imp.textContent=pmT("Importer un Word");exp.textContent=pmT("Télécharger en Word");hint.textContent=pmT("L’import remplace le contenu. Titres, gras, italique et listes sont conservés, les images ne sont pas reprises.");}
else if(kind==="sheet"){imp.textContent=pmT("Importer un Excel");exp.textContent=pmT("Télécharger en Excel");hint.textContent=pmT("L’import remplace le contenu, sur 300 lignes et 40 colonnes au maximum. Les formules SOMME, MOYENNE, MIN, MAX, NB et les calculs simples sont repris, les autres sont remplacées par leur valeur.");}
else{imp.textContent=pmT("Importer un PowerPoint");exp.textContent=pmT("Télécharger en PowerPoint");hint.textContent=pmT("L’import remplace les diapositives et ne reprend que le texte : images et mise en page ne sont pas conservées.");}
}

async function importDocx(file){
if(!await pmNeed("mammoth",function(){return typeof mammoth!=="undefined";}))throw new Error(pmT("le convertisseur n’a pas pu être chargé"));
var res=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},{styleMap:["u => u","strike-through => s"]});
var html=String(res.value||"").replace(/<img[^>]*>/gi,"");
var safe=pmCleanHtml(html);
if(safe===null)throw new Error(pmT("le filtre de sécurité n’est pas chargé"));
if(!safe.trim())throw new Error(pmT("le fichier ne contient pas de texte"));
document.getElementById("pm-rich-editor").innerHTML=safe;
}

async function importXlsx(file){
if(!await pmNeed("xlsx",function(){return typeof XLSX!=="undefined";}))throw new Error(pmT("le convertisseur n’a pas pu être chargé"));
var wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:"array",cellFormula:true});
var ws=wb.Sheets[wb.SheetNames[0]];
if(!ws||!ws["!ref"])throw new Error(pmT("la feuille est vide"));
var rg=XLSX.utils.decode_range(ws["!ref"]);
var maxR=Math.min(rg.e.r,299),maxC=Math.min(rg.e.c,39);
var comma=/^(fr|es|pt)/.test(pmLocale());
var grid=[],any=false;
for(var r=0;r<=maxR;r++){var line=[];for(var c=0;c<=maxC;c++){
var cell=ws[XLSX.utils.encode_cell({r:r,c:c})];var val="";
if(cell){
var f=cell.f?pmFromExcelFormula(cell.f):null;
if(f)val=f;
else if(cell.t==="n"&&typeof cell.v==="number"&&(!cell.w||/^[-\d\s.,]+$/.test(cell.w))){val=String(cell.v);if(comma)val=val.replace(".",",");}
else if(cell.w!=null)val=String(cell.w);
else if(cell.v!=null)val=String(cell.v);}
if(val!=="")any=true;line.push(val);}grid.push(line);}
if(!any)throw new Error(pmT("la feuille est vide"));
sheetData=grid;renderSheet();
}

function pmXmlText(x){return String(x).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,String.fromCharCode(34)).replace(/&apos;/g,String.fromCharCode(39)).replace(/&amp;/g,"&");}
async function importPptx(file){
if(!await pmNeed("fflate",function(){return typeof fflate!=="undefined";}))throw new Error(pmT("le convertisseur n’a pas pu être chargé"));
var zip=fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
var names=Object.keys(zip).filter(function(k){return /^ppt\/slides\/slide[0-9]+\.xml$/.test(k);})
.sort(function(a,b){return parseInt(a.replace(/[^0-9]+/g,""),10)-parseInt(b.replace(/[^0-9]+/g,""),10);});
if(names.length===0)throw new Error(pmT("aucune diapositive trouvée"));
var dec=new TextDecoder("utf-8");
var out=names.slice(0,60).map(function(k){
var xml=dec.decode(zip[k]);var texts=[];var re=/<a:t[^>]*>([\s\S]*?)<\/a:t>/g;var m;
while((m=re.exec(xml))){var t=pmXmlText(m[1]).trim();if(t)texts.push(t);}
return {title:texts.shift()||pmT("Sans titre"),body:texts.join("\n")};});
renderSlides(out);
}

// --- generation d un vrai .docx, sans serveur
function pmX(v){return String(v===undefined||v===null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function pmRuns(node,b,i,u){
var out="";
for(var c=node.firstChild;c;c=c.nextSibling){
if(c.nodeType===3){if(c.nodeValue)out+="<w:r><w:rPr>"+(b?"<w:b/>":"")+(i?"<w:i/>":"")+(u?String.fromCharCode(60)+"w:u w:val=\"single\"/>":"")+"</w:rPr><w:t xml:space=\"preserve\">"+pmX(c.nodeValue)+"</w:t></w:r>";}
else if(c.nodeType===1){var t=c.tagName.toLowerCase();if(t==="br"){out+="<w:r><w:br/></w:r>";}else{out+=pmRuns(c,b||t==="b"||t==="strong",i||t==="i"||t==="em",u||t==="u");}}
}return out;}
function pmParas(root){
var paras=[];
function para(style,node,prefix){
var runs=(prefix?"<w:r><w:t xml:space=\"preserve\">"+pmX(prefix)+"</w:t></w:r>":"")+pmRuns(node,false,false,false);
if(!runs)return;
paras.push("<w:p><w:pPr>"+(style?String.fromCharCode(60)+"w:pStyle w:val=\""+style+"\"/>":"")+"</w:pPr>"+runs+"</w:p>");}
for(var el=root.firstChild;el;el=el.nextSibling){
if(el.nodeType===3){if(el.nodeValue&&el.nodeValue.trim())paras.push("<w:p><w:r><w:t xml:space=\"preserve\">"+pmX(el.nodeValue)+"</w:t></w:r></w:p>");continue;}
if(el.nodeType!==1)continue;
var tag=el.tagName.toLowerCase();
if(tag==="h1"||tag==="h2"||tag==="h3"||tag==="h4"){para("Heading"+tag.charAt(1),el,"");}
else if(tag==="ul"||tag==="ol"){var idx=1;for(var li=el.firstChild;li;li=li.nextSibling){if(li.nodeType===1&&li.tagName.toLowerCase()==="li"){para("",li,(tag==="ol"?(idx++)+". ":String.fromCharCode(8226)+" "));}}}
else{para("",el,"");}
}
if(paras.length===0)paras.push("<w:p/>");
return paras.join("");}
function pmStylesXml(){
var h=[["Heading1",32],["Heading2",28],["Heading3",24],["Heading4",22]].map(function(x){
return String.fromCharCode(60)+"w:style w:type=\"paragraph\" w:styleId=\""+x[0]+"\"><w:name w:val=\""+x[0]+"\"/><w:basedOn w:val=\"Normal\"/><w:pPr><w:spacing w:before=\"240\" w:after=\"120\"/><w:outlineLvl w:val=\""+(x[0].slice(-1)-1)+"\"/></w:pPr><w:rPr><w:b/><w:color w:val=\"136577\"/><w:sz w:val=\""+x[1]+"\"/></w:rPr></w:style>";}).join("");
return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style>'+h+"</w:styles>";}
async function exportDocx(){
if(!await pmNeed("fflate",function(){return typeof fflate!=="undefined";}))throw new Error(pmT("le convertisseur n’a pas pu être chargé"));
var body=pmParas(document.getElementById("pm-rich-editor"));
var doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+"<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"1134\" w:right=\"1134\" w:bottom=\"1134\" w:left=\"1134\"/></w:sectPr></w:body></w:document>";
var ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
var rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
var drels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
var enc=new TextEncoder();
var files={};
files["[Content_Types].xml"]=enc.encode(ct);
files["_rels/.rels"]=enc.encode(rels);
files["word/document.xml"]=enc.encode(doc);
files["word/_rels/document.xml.rels"]=enc.encode(drels);
files["word/styles.xml"]=enc.encode(pmStylesXml());
var zipped=fflate.zipSync(files,{level:6});
pmDownload(new Blob([zipped],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),pmFileName("docx"));
}
async function exportXlsx(){
if(!await pmNeed("xlsx",function(){return typeof XLSX!=="undefined";}))throw new Error(pmT("le convertisseur n’a pas pu être chargé"));
var ev=pmSheetEval(sheetData||[]);var ws={};var maxR=0,maxC=0;
(sheetData||[]).forEach(function(row,r){row.forEach(function(v,c){
var raw=String(v==null?"":v);if(raw==="")return;
var cell;
if(raw.charAt(0)==="="){var f=pmToExcelFormula(raw);var res=ev(r,c);
if(f===null)cell={t:"s",v:raw};
else if(res.err)cell={t:"e",f:f,v:PM_XL_ERR[res.err]||15};
else cell={t:"n",f:f,v:res.v};}
else{var n=pmParseNum(raw);if(n===null)cell={t:"s",v:raw};else{cell={t:"n",v:n};if(/%\s*$/.test(raw))cell.z="0%";}}
ws[XLSX.utils.encode_cell({r:r,c:c})]=cell;if(r>maxR)maxR=r;if(c>maxC)maxC=c;});});
ws["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:maxR,c:maxC}});
var wb=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,ws,"Feuille1");
var buf=XLSX.write(wb,{bookType:"xlsx",type:"array"});
pmDownload(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),pmFileName("xlsx"));
}
async function exportPptx(){
if(!await pmNeed("pptx",function(){return typeof PptxGenJS!=="undefined";}))throw new Error(pmT("le convertisseur n’a pas pu être chargé"));
var slides=collectSlides();
if(!slides.length)throw new Error(pmT("le document est vide"));
var deck=new PptxGenJS();
deck.layout="LAYOUT_16x9";
slides.forEach(function(s){
var sl=deck.addSlide();
sl.addText(String(s.title||""),{x:0.6,y:0.5,w:9,h:1,fontSize:28,bold:true,color:"136577"});
sl.addText(String(s.body||""),{x:0.6,y:1.7,w:9,h:3.4,fontSize:16,color:"333333",valign:"top"});});
await deck.writeFile({fileName:pmFileName("pptx")});
}

document.getElementById("pm-import").addEventListener("click",function(){
if(!currentDoc)return;
var f=document.getElementById("pm-file");
f.value="";
f.accept=currentDoc.kind==="doc"?".docx":(currentDoc.kind==="sheet"?".xlsx,.csv":".pptx");
f.click();});
document.getElementById("pm-file").addEventListener("change",async function(){
var file=this.files&&this.files[0];
if(!file||!currentDoc)return;
if(!confirm(pmT("L’import va remplacer le contenu actuel de ce document. Continuer ?")))return;
var msgEl=document.getElementById("pm-editor-msg");
setSaveState(pmT("Import en cours…"));
try{
if(currentDoc.kind==="doc")await importDocx(file);
else if(currentDoc.kind==="sheet")await importXlsx(file);
else await importPptx(file);
markDirty();
pmShowMessage(msgEl,pmT("Fichier importé. À relire, puis à enregistrer."),"ok");
}catch(e){pmShowMessage(msgEl,pmT("Import impossible : {m}").replace("{m}",String((e&&e.message)||e)),"error");setSaveState("");}});
document.getElementById("pm-export").addEventListener("click",async function(){
if(!currentDoc)return;
var msgEl=document.getElementById("pm-editor-msg");
var btn=this;btn.disabled=true;
try{
if(currentDoc.kind==="doc")await exportDocx();
else if(currentDoc.kind==="sheet")await exportXlsx();
else await exportPptx();
}catch(e){pmShowMessage(msgEl,pmT("Téléchargement impossible : {m}").replace("{m}",String((e&&e.message)||e)),"error");}
finally{btn.disabled=false;}});
