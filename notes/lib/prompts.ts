export const REGLES = `Règles d'écriture :
- Français, phrases claires et courtes.
- N'utilise jamais de tiret cadratin (—). Remplace-le par une virgule, des parenthèses ou deux-points.
- Reste fidèle au cours : n'invente rien, ne complète pas avec tes connaissances. Si un passage est inaudible ou incertain, écris [passage peu clair].
- Garde tout le contenu utile : définitions, explications, exemples, anecdotes illustratives, chiffres, noms, consignes et dates.
- Retire le superflu : hésitations, répétitions, digressions hors sujet, problèmes techniques, logistique sans intérêt.
- La transcription automatique contient des erreurs (mots mal reconnus, passages en anglais par erreur) : corrige-les quand le sens est évident.`;

export const SEPARATEUR = "%%%HORS-COURS%%%";

export function promptNotes(i: number, n: number, titresPrecedents: string[], meta: string) {
  return `Tu rédiges le rendu détaillé et fidèle d'un cours, à partir de sa transcription automatique, morceau par morceau. ${meta}
Tu reçois le morceau ${i + 1} sur ${n}.

Tu sépares strictement deux choses :
1. LE COURS PROPREMENT DIT : le contenu enseigné (notions, définitions, explications, théories, auteurs, exemples et cas qui illustrent le contenu, schémas, échanges entre le prof et les étudiants quand ils apportent du contenu).
2. LE HORS-COURS : tout le reste qui mérite d'être gardé (organisation de l'intervention, objectifs pédagogiques, travail demandé, évaluation et barème, planning et dates, consignes, devoirs à préparer, visites ou intervenants prévus, présentations des participants, conseils sur les stages ou l'orientation, contacts, documents promis).
Le superflu (bavardages, problèmes techniques, pauses, hésitations) ne va nulle part.

Format de ta réponse :
- D'abord le cours, en Markdown : titres de partie en "## " et sous-parties en "### ", paragraphes courts, listes à puces pour les énumérations, tableaux Markdown pour comparer, citations "> " pour les définitions exactes et les encadrés d'exemple, notions clés en **gras**. Ne répète pas un titre déjà utilisé : si le morceau continue la partie précédente, commence directement par le texte ou par un "### ".
- Puis, seule sur sa ligne, la ligne exacte ${SEPARATEUR}
- Puis le hors-cours de ce morceau en puces courtes et factuelles (dates, chiffres, consignes exactes). S'il n'y en a pas, n'écris rien après le séparateur.
- Pas d'introduction ni de conclusion générale, pas de phrase du type "Dans ce morceau".
- Si une liste de VISUELS est fournie (slides, captures, photos du tableau), insère le repère [[VISUEL:Vn]] seul sur sa ligne, juste après le paragraphe que ce visuel illustre le mieux. N'insère que les visuels utiles (schémas, tableaux, définitions, slides de contenu), jamais deux fois le même, et jamais dans le hors-cours.
${titresPrecedents.length ? `\nTitres de cours déjà utilisés dans les morceaux précédents : ${titresPrecedents.join(" | ")}` : ""}

${REGLES}`;
}

export const PROMPT_INFOS = `Voici les informations hors cours relevées pendant une séance (organisation, évaluation, planning, consignes, échanges pratiques), dans le désordre et parfois en double.
Range-les en une section Markdown propre, sans doublons, avec uniquement les sous-titres "### " utiles parmi : Organisation de l'intervention, Objectifs et travail demandé, Évaluation, Planning et dates, À faire ou à préparer, Intervenants, visites et contacts, Autres échanges.
Garde toutes les précisions concrètes (dates, chiffres, critères, consignes exactes). Utilise des tableaux Markdown pour un planning ou un barème. Commence directement par le premier "### ".

${REGLES}`;

export const PROMPT_BREF = `À partir des notes d'un cours (contenu enseigné uniquement), écris la section d'ouverture "## La séance en bref" :
- 2 ou 3 phrases qui disent de quoi parle la séance et ce qu'elle construit ;
- puis "**Déroulé du cours**" suivi d'une liste numérotée des grandes parties du contenu (5 à 10 lignes).
Réponds uniquement avec ce Markdown.

${REGLES}`;

export const PROMPT_QUIZ = `À partir des notes d'un cours, crée un quiz de révision de 12 questions à choix multiples qui vérifient que l'étudiant a retenu l'essentiel (définitions, distinctions, exemples, chiffres, auteurs). Les questions portent uniquement sur le contenu du cours, jamais sur l'organisation ou l'évaluation.
Chaque question a 4 choix plausibles et une seule bonne réponse, avec une explication courte (1 à 2 phrases) tirée du cours.
Réponds uniquement avec un objet JSON valide, sans texte avant ni après, sans bloc de code : {"questions":[{"question":"...","choix":["...","...","...","..."],"bonne":0,"explication":"..."}]} où "bonne" est l'index (0 à 3) de la bonne réponse. Varie la position de la bonne réponse.
Dans les textes, n'utilise jamais de guillemets droits ("). Pour citer, utilise les guillemets français « ».

${REGLES}`;

export const PROMPT_FICHE = `À partir des notes d'un cours, écris une fiche de révision express : 6 à 9 puces très courtes (une ligne chacune), avec les notions clés en **gras**. C'est une toute petite fiche à relire en 1 minute avant un examen.
Réponds uniquement avec la liste Markdown, sans titre.

${REGLES}`;

export const PROMPT_OCR = `Voici la photo d'une diapositive, d'un tableau ou d'un document de cours. Recopie fidèlement tout le texte lisible, dans l'ordre de lecture, en Markdown simple (titres, puces, tableaux si besoin). Décris en une phrase entre crochets un schéma important s'il y en a un. Si l'image ne contient rien de lisible, réponds [rien de lisible]. Pas de commentaire. N'utilise jamais de tiret cadratin.`;

export const PROMPT_QUESTIONS = (n: number, existantes: string[]) => `À partir de cette partie d'un cours, crée ${n} questions de révision à choix multiples qui couvrent TOUT l'essentiel de cette partie : définitions, distinctions entre notions, auteurs et dates, chiffres, exemples concrets, étapes, causes et conséquences, mises en application.
Varie les types : définition, « lequel de ces exemples illustre… », vrai/faux reformulé en choix, intrus, association notion/auteur, cas pratique. Les questions portent uniquement sur le contenu enseigné, jamais sur l'organisation du cours.
Chaque question a 4 choix plausibles (les mauvais réponses doivent être crédibles) et une seule bonne réponse, plus une explication courte (1 à 2 phrases) tirée du cours.
${existantes.length ? `Ne reprends aucune de ces questions déjà posées, ni leur sens :\n- ${existantes.slice(0, 60).join("\n- ")}\n` : ""}
Réponds uniquement avec un objet JSON valide, sans texte avant ni après, sans bloc de code : {"questions":[{"question":"...","choix":["...","...","...","..."],"bonne":0,"explication":"..."}]} où "bonne" est l'index (0 à 3) de la bonne réponse. Varie la position de la bonne réponse.
Dans les textes, n'utilise jamais de guillemets droits ("). Pour citer, utilise les guillemets français « ».

${REGLES}`;

export const PROMPT_PLAN = `Voici, dans l'ordre, les sections d'un cours rédigé morceau par morceau (numéro, titre, début du texte). Le découpage est trop fin et contient des doublons.
Construis un plan propre :
- regroupe les sections en 4 à 8 chapitres cohérents, dans l'ordre du cours, avec un titre de chapitre court et clair ;
- chaque section va dans un seul chapitre ; des sections consécutives sur le même sujet vont ensemble ;
- les sections qui ne sont PAS du contenu enseigné (organisation, objectifs pédagogiques, évaluation, planning, consignes, présentations, visites, travail de groupe, logistique) vont dans "hors_cours".
Réponds uniquement avec un objet JSON valide : {"chapitres":[{"titre":"...","sections":[0,1,2]}],"hors_cours":[5,6]}`;
