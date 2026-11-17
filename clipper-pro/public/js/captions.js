// Accroches, légendes et hashtags : modèles variés par genre et par ton, réplique tirée des sous-titres, variantes A/B.
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const MASS = ['#cinema', '#film', '#scenedefilm', '#viral', '#pourtoi', '#fyp', '#foryou', '#filmtok', '#movietok', '#tiktokfrance', '#cinephile', '#scenecult', '#bestscene', '#extraitdefilm'];
const EMO = { 'Action / Thriller': ['🔥', '💥', '⚡', '🎬'], 'Humour / Comédie': ['😂', '🤣', '😅', '🎬'], 'Amour / Romance': ['❤️', '😍', '🥹', '🎬'], 'Horreur / Frisson': ['😱', '👻', '🩸', '🎬'], 'Science-fiction': ['🚀', '🤖', '🌌', '🎬'], 'Science / Documentaire': ['🧠', '🔬', '🌍', '🎬'] };
const G = {
  'Action / Thriller': { h: ['Cette scène ne laisse aucun répit', 'Impossible de décrocher les yeux', 'Là, tout bascule', 'Un passage qui tient en haleine', 'L’adrénaline à l’état pur', 'Personne ne s’attendait à ça', 'Quelques minutes qui passent à toute vitesse', 'La tension monte à chaque seconde', 'Tu n’as pas le temps de cligner des yeux', 'Quand l’action ne ralentit jamais'], q: ['Tu aurais fait quoi à sa place ?', 'Tu la ressens comment, cette tension ?', 'Elle est dans ton top des scènes d’action ?', 'Tu aurais tenu jusqu’au bout ?', 'Tu as retenu ton souffle, toi aussi ?', 'Quel est le moment le plus intense selon toi ?', 'Tu l’avais vu venir ?', 'Tu en veux d’autres comme celle-là ?'], t: ['#action', '#thriller', '#filmdaction', '#scenedaction', '#poursuite', '#combat', '#adrenaline', '#suspense', '#actionmovie', '#thrillerfilm', '#cinemadaction', '#scenedecombat'] },
  'Humour / Comédie': { h: ['Cette scène m’a fait éclater de rire', 'Le meilleur moment du film ?', 'Impossible de ne pas sourire', 'Une scène culte, avoue', 'Je ne m’en lasse pas', 'Quand tout dérape, c’est comique', 'Le timing est parfait', 'Regarde jusqu’à la chute', 'Sérieusement, comment ne pas rire ?', 'La scène qui sauve ta journée'], q: ['Tu as ri à quel moment ?', 'Tu connaissais cette scène ?', 'Quelle est ta réplique préférée ?', 'Tu la reverrais combien de fois ?', 'Tu la partages à qui ?', 'C’est quoi le passage le plus drôle ?', 'Tu aurais réagi comment ?', 'Tu tiens combien de secondes sans rire ?'], t: ['#humour', '#comedie', '#filmcomique', '#drole', '#rire', '#comedy', '#replique', '#scenedrole', '#humourfrancais', '#mdr', '#filmhumour', '#comedyfilm'] },
  'Amour / Romance': { h: ['Une scène qui fait battre le cœur', 'Romantique, tout simplement', 'Ce moment, on ne l’oublie pas', 'Les émotions sont là', 'Un regard suffit', 'La scène qui fait fondre', 'Quand les mots n’ont plus besoin d’être dits', 'Le genre de scène qu’on rejoue dans sa tête', 'Un instant suspendu', 'Pour ceux qui croient encore aux belles histoires'], q: ['Tu es plutôt romantique ?', 'Elle t’a ému aussi ?', 'Tu l’aurais écrite comme ça, toi ?', 'Tu la dédierais à qui ?', 'Elle te rappelle quelque chose ?', 'Tu y crois, à ce genre d’amour ?', 'Quel est ton moment préféré ?', 'Tu en veux d’autres comme celle-là ?'], t: ['#romance', '#amour', '#filmromantique', '#lovestory', '#couple', '#emotion', '#scenedamour', '#romantique', '#coeur', '#histoiredamour', '#filmdamour', '#movieromance'] },
  'Horreur / Frisson': { h: ['Frissons garantis', 'Ne regarde pas ça seul la nuit', 'L’angoisse monte, lentement', 'Cette scène fait vraiment peur', 'Tu entends ça aussi ?', 'Le silence avant la peur', 'Regarde derrière toi', 'Ce qui se cache dans l’ombre', 'La peur, minute après minute', 'À éviter avant de dormir'], q: ['Tu aurais tenu jusqu’au bout ?', 'Tu as eu peur à quel moment ?', 'Tu regardes ça la lumière allumée ?', 'Tu fermes les yeux ou tu regardes ?', 'Quelle scène t’a le plus marqué ?', 'Tu aurais ouvert cette porte ?', 'Tu restes dans la pièce ou tu pars ?', 'Tu en veux d’autres comme celle-là ?'], t: ['#horreur', '#filmdhorreur', '#frisson', '#peur', '#horror', '#suspense', '#terreur', '#scenedepeur', '#creepy', '#horrormovie', '#nuitblanche', '#cinemadhorreur'] },
  'Science-fiction': { h: ['Un futur qui donne le vertige', 'La science-fiction à son meilleur', 'Cette scène vaut le détour', 'Un autre monde, une scène marquante', 'Et si c’était possible ?', 'Le futur est déjà là', 'Quand l’imagination dépasse la réalité', 'Un univers qu’on voudrait explorer', 'La technologie va trop loin', 'Ce décor donne envie de voyager'], q: ['Tu y crois, à ce futur ?', 'Tu serais monté à bord ?', 'C’est ton genre de film ?', 'Tu aimerais vivre là-bas ?', 'Quel film de SF faut-il voir ensuite ?', 'Tu ferais confiance à cette technologie ?', 'Quel est ton univers préféré ?', 'Tu en veux d’autres comme celle-là ?'], t: ['#sciencefiction', '#scifi', '#filmscifi', '#futur', '#espace', '#robot', '#cyberpunk', '#dystopie', '#spacemovie', '#scifimovie', '#univers', '#technologie'] },
  'Science / Documentaire': { h: ['Tu ne regarderas plus ça pareil', 'Un moment qui fait réfléchir', 'On apprend quelque chose, là', 'Ce passage mérite d’être vu', 'Le saviez-vous ?', 'Ce détail change tout', 'Ce que personne ne t’a expliqué', 'Quand la science devient spectaculaire', 'Voilà pourquoi c’est fascinant', 'Un fait qui surprend'], q: ['Tu le savais déjà ?', 'Qu’est-ce qui t’a le plus surpris ?', 'Tu veux la suite ?', 'Tu en veux d’autres comme ça ?', 'Ça change ta vision des choses ?', 'Quel sujet je dois traiter ensuite ?', 'Tu l’aurais deviné ?', 'Tu partages ça à qui ?'], t: ['#science', '#documentaire', '#savoir', '#culturegenerale', '#apprendre', '#education', '#decouverte', '#nature', '#sciencetok', '#lesaviezvous', '#curiosite', '#connaissance'] },
};
export const GENRES = Object.keys(G);
const TONE = {
  'Direct': { h: ['À voir absolument', 'Regarde ça', 'Le passage à ne pas rater', 'Ça vaut le coup d’œil', 'Voilà pourquoi tout le monde en parle'], q: ['Ton avis ?', 'Tu en penses quoi ?', 'Dis-moi ce que tu en as pensé.', 'Tu valides ?'] },
  'Mystérieux': { h: ['Personne ne parle de cette scène…', 'Regarde bien jusqu’au bout…', 'Il y a un détail que tu vas rater', 'Tu n’as peut-être pas tout vu', 'Quelque chose cloche dans cette scène'], q: ['Tu as remarqué le détail ?', 'Tu devines la suite ?', 'Tu as vu ce que j’ai vu ?', 'À ton avis, que va-t-il se passer ?'] },
  'Drôle': { h: ['Je n’arrête pas de rire', 'Cette scène est trop bonne', 'Je ne m’en remets pas', 'Si tu ne ris pas, tu es fort', 'Interdit d’être aussi drôle'], q: ['Tu tiens combien de secondes ?', 'Note la scène sur 10 ?', 'Tu l’envoies à qui ?', 'Tu ris à quelle seconde ?'] },
  'Dramatique': { h: ['Cette scène m’a marqué', 'Un moment qui prend aux tripes', 'Impossible de rester indifférent', 'Tout se joue ici', 'La scène qu’on n’oublie pas'], q: ['Tu as ressenti la même chose ?', 'Tu aurais fait pareil ?', 'Elle t’a touché ?', 'Tu en dis quoi, en commentaire ?'] },
  'Complice': { h: ['Avoue, tu l’avais vue venir ?', 'Entre nous, cette scène est géniale', 'Dis-moi que je ne suis pas le seul', 'Je sais que toi aussi tu l’aimes', 'Toi aussi, tu l’as revue dix fois ?'], q: ['Tu fais partie de la team ?', 'On est d’accord ?', 'Dis-moi en commentaire si tu es avec moi.', 'Tu l’as déjà partagée ?'] },
};
export const TONES = Object.keys(TONE);
const NAMED = [n => n + ' : une scène à revoir.', n => 'Extrait de ' + n + ', à ne pas rater.', n => 'Tu connais ' + n + ' ? Voici un passage marquant.', n => n + ', et cette scène-là.', n => 'Dans ' + n + ', ce passage fait toute la différence.', n => n + ' : le moment que tout le monde retient.', n => 'Si tu aimes ' + n + ', regarde ça.', n => 'Retour sur ' + n + ', en une scène.'];
const PLAIN = ['Une scène à revoir.', 'Un passage marquant.', 'Cette scène vaut le détour.', 'Le genre de moment qu’on revoit en boucle.', 'Une scène qui mérite plus de vues.'];
const NOTE_T = [n => 'Quand ' + n + '…', n => cap(n) + ' : et là, tout change.', n => 'Imagine : ' + n + '.', n => 'POV : ' + n, n => cap(n) + '. Voilà la scène.', n => 'Le moment où ' + n + '.', n => cap(n) + ', et personne ne s’y attendait.', n => 'Tout commence quand ' + n + '.'];
const SHORT = [n => 'Extrait de ' + n + '.', n => 'Tiré de ' + n + '.', n => 'Scène de ' + n + '.', n => n + '.'];
const CTA1 = ['Abonne-toi pour une scène culte par jour !', 'Rejoins-moi pour la prochaine scène !', 'Suis le compte pour ne rien rater !', 'D’autres scènes arrivent, abonne-toi !', 'Abonne-toi, la prochaine scène est encore mieux.', 'Mets-la en favori et abonne-toi pour la suite.', 'Partage-la à quelqu’un qui doit la voir !', 'Une nouvelle scène demain : abonne-toi pour ne pas la rater !'];
const CTAM = [p => 'Abonne-toi pour voir la partie ' + p + ' !', p => 'La partie ' + p + ' arrive, suis le compte pour ne pas la rater !', p => 'Suite dans la partie ' + p + ' : abonne-toi !', p => 'Tu veux la partie ' + p + ' ? Abonne-toi et dis-le moi en commentaire !', p => 'On continue dans la partie ' + p + ' : abonne-toi pour ne pas la rater !', p => 'La partie ' + p + ' est encore plus forte, abonne-toi !'];
const CTAL = ['Dis-moi en commentaire ce que tu en as pensé, et abonne-toi pour la prochaine scène !', 'C’était la dernière partie : ton avis en commentaire ?', 'Fin de la série : laisse ton avis et abonne-toi pour la suite du programme !', 'Voilà, tu as tout vu. Une autre scène arrive bientôt, abonne-toi !', 'Alors, verdict ? Dis-le moi en commentaire !', 'Merci d’avoir regardé jusqu’au bout, abonne-toi pour la suite !'];

const decks = {};
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function take(key, pool, n) {
  const s = decks[key] || (decks[key] = { q: [] }), out = [], max = Math.min(n, pool.length);
  let guard = 0;
  while (out.length < max && guard++ < 500) { if (!s.q.length) s.q = shuffle(pool.slice()); const x = s.q.pop(); if (pool.indexOf(x) > -1 && out.indexOf(x) < 0) out.push(x); }
  return out;
}
const nz = s => s.normalize('NFD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

// Extrait une courte réplique percutante des sous-titres (question, exclamation, ou phrase courte).
export function pickQuote(words) {
  if (!words || words.length < 3) return '';
  const text = words.map(w => w.w).join(' '), sents = text.split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(s => s.split(' ').length >= 3 && s.split(' ').length <= 12);
  if (!sents.length) return '';
  sents.sort((a, b) => (/[!?]$/.test(b) ? 1 : 0) - (/[!?]$/.test(a) ? 1 : 0) || a.length - b.length);
  return sents[0].replace(/^["«\s]+|["»\s]+$/g, '');
}

function tagsFor(o, g) {
  const name = o.name, base = nz(name), nh = +o.nh;
  let ultra = [];
  if (base.length > 1) { ultra.push('#' + base, '#' + base + 'film', '#' + base + 'scene'); name.split(' ').forEach(w => { const z = nz(w); if (z.length > 3) ultra.push('#' + z); }); }
  (o.cast || []).forEach(p => { const z = nz(p); if (z.length > 2) { ultra.push('#' + z); const zl = nz(p.split(' ').pop()); if (zl.length > 3 && zl !== z) ultra.push('#' + zl); } });
  (o.kw || []).forEach(k => { const z = nz(k); if (z.length > 2) ultra.push('#' + z); });
  ultra = ultra.filter((x, i, a) => a.indexOf(x) === i);
  const c = o.clip, forced = c.k > 1 ? ['#partie' + c.j].concat(c.j < c.k && !c.nonext ? ['#suite'] : []) : [];
  const tu = Math.round(nh * .35), nu = Math.min(ultra.length, tu), nn = Math.min(g.t.length, Math.round(nh * .4) + (tu - nu));
  const nm = Math.max(0, nh - forced.length - nu - nn);
  return forced.concat(take('u' + ultra.join(), ultra, nu), take('n' + o.genre, g.t, nn), take('m', MASS, nm));
}

// o : { clip, name, genre, tone, emo, nh, cast, kw, note, quote }
export function hooksFor(o, n = 2) {
  const g = G[o.genre] || G['Action / Thriller'], tone = TONE[o.tone] || TONE.Direct, ej = EMO[o.genre] || EMO['Action / Thriller'];
  const pool = g.h.concat(tone.h), list = take('h' + o.genre + o.tone, pool, n);
  if (o.quote) list[0] = '« ' + o.quote + ' »';
  return list.map(h => (o.emo ? take('e' + o.genre, ej, 1)[0] + ' ' : '') + h + (o.clip.k > 1 ? ' (partie ' + o.clip.j + '/' + o.clip.k + ')' : ''));
}

export function buildCaption(o, hook) {
  const g = G[o.genre] || G['Action / Thriller'], tone = TONE[o.tone] || TONE.Direct, ej = EMO[o.genre] || EMO['Action / Thriller'], c = o.clip;
  hook = hook || hooksFor(o, 1)[0];
  const nt = (o.note || '').trim().replace(/[.!?…]+$/, ''), name = o.name;
  let intro;
  if (nt) { intro = take('ni', NOTE_T, 1)[0](nt); if (name && Math.random() < .5) intro = take('ns', SHORT, 1)[0](name) + ' ' + intro; }
  else intro = name ? take('i', NAMED, 1)[0](name) : take('ip', PLAIN, 1)[0];
  if (c.k > 1 && c.j > 1) intro += ' Partie ' + (c.j - 1) + ' sur mon profil.';
  let q = take('q' + o.genre + o.tone, g.q.concat(tone.q), 1)[0];
  if (o.emo && Math.random() < .5) q += ' ' + take('e' + o.genre, ej, 1)[0];
  const cta = c.k > 1 && !(c.j < c.k && c.nonext) ? (c.j < c.k ? take('cm', CTAM, 1)[0](c.j + 1) : take('cl', CTAL, 1)[0]) : take('c1', CTA1, 1)[0];
  const L = take('ly', [1, 2, 3], 1)[0], tg = tagsFor(o, g).join(' ');
  const body = L === 1 ? intro + ' ' + q + ' ' + cta : L === 2 ? intro + ' ' + cta + '\n\n' + q : intro + ' ' + cta;
  return (L === 3 ? hook + ' ' + q : hook) + '\n\n' + body + '\n\n' + tg;
}

export function aiPrompt(o, clips, notes) {
  const lines = clips.map(c => '- Moment ' + c.m + (c.k > 1 ? ', partie ' + c.j + ' sur ' + c.k : ', clip unique') + ' (' + Math.round(c.e - c.s) + ' s)' + (notes[c.key] ? ' : ' + notes[c.key] : '') + (c.quote ? ' ; réplique : « ' + c.quote + ' »' : '')).join('\n');
  return ['Tu es un expert de la croissance sur TikTok. Rédige en français les textes de ' + clips.length + ' extraits vidéo de l’œuvre « ' + (o.name || 'titre à préciser') + ' » (genre : ' + o.genre + ', ton : ' + o.tone + ').', '', 'Clips :', lines, '',
    'Pour chaque clip, donne : 1) deux accroches différentes de 60 caractères maximum (A et B, pour tester laquelle marche le mieux), 2) une légende de 2 à 3 phrases avec une question d’engagement et un appel à s’abonner (pour une partie qui n’est pas la dernière, invite à s’abonner pour voir la suite), 3) ' + o.nh + ' hashtags : 3 larges, 3 de niche, le reste ciblé sur le titre, les acteurs (' + ((o.cast || []).join(', ') || 'non précisés') + ') et les mots-clés (' + ((o.kw || []).join(', ') || 'non précisés') + ').', '',
    'Règles : varie les formulations d’un clip à l’autre, n’invente aucun détail d’intrigue que je ne t’ai pas donné, évite les formules toutes faites comme « à voir absolument » ou « incroyable ».'].join('\n');
}

// Contrôle d'une légende pour le score de viralité.
export function captionChecks(text) {
  const t = text || '', tags = (t.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  return { question: /\?/.test(t), cta: /abonne|suis le compte|partage|commentaire/i.test(t), tags, tagsOk: tags >= 5 && tags <= 12 };
}
