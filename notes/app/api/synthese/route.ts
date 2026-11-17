import { NextResponse } from "next/server";
import { context, smartChat, fail, HttpError, sansCadratin } from "@/lib/server";

export const maxDuration = 120;

const STYLE = `Style : français clair, phrases courtes, notions clés en **gras**, auteurs toujours avec leur date entre parenthèses quand le cours la donne. Reste fidèle au cours : n'invente ni auteur, ni date, ni chiffre. N'utilise jamais de tiret cadratin (—) : remplace-le par une virgule, des parenthèses ou deux-points. Pas de phrase d'introduction du type « Voici » ou « Ce chapitre présente ».`;

const PARTIE = (n: number) => `Tu transformes un chapitre de cours en partie d'un « cours de révision » : un document complet pour réviser un examen, qui garde tout ce qui est utile pour comprendre et retenir, et enlève le reste.

Structure attendue :
- Titre "## Partie ${n} : <titre court du chapitre>", puis une phrase qui dit à quelle question répond cette partie.
- Des sous-parties numérotées "### ${n}.1 <titre>", "### ${n}.2 <titre>"…, une par notion, modèle ou idée importante.
- Dans chaque sous-partie, selon ce que le cours contient :
  - **Origines** ou **Auteurs** (avec dates), **Définition** exacte, **Hypothèse**, **Présupposés** en liste numérotée ;
  - les mécanismes ou étapes en liste (Avant / Pendant / Après, étapes 1, 2, 3…) ;
  - un tableau Markdown dès qu'il y a une comparaison ou des rôles (par exemple : Rôle de l'élève | Rôle de l'enseignant | Place de l'erreur ; ou Ajout | Retrait) ;
  - « **Avantages :** » et « **Limites :** » quand le cours les donne ;
  - « **Exemple :** » avec les exemples concrets du cours (études, campagnes, cas, chiffres) ; si le cours n'en donne pas et que la notion est abstraite, ajoute un exemple simple et réaliste introduit par « **Exemple (pour comprendre) :** » ;
  - « **Astuce mémoire :** » quand une distinction est piégeuse (positif/négatif, deux notions proches).
- Si le texte indique sa source (« Source : Séance … »), mentionne la séance en italique sous le titre.
- Termine par un paragraphe « **À retenir :** » de 2 à 4 phrases denses, ou « **À retenir en une ligne par …** » s'il y a plusieurs modèles.

Garde tous les auteurs, dates, définitions, distinctions, chiffres et exemples utiles. Supprime les répétitions et les digressions.

${STYLE}`;

const INTRO = `Tu écris le début d'un « cours de révision » à partir du plan du cours, des points « À retenir » de chaque partie et des informations pratiques (évaluation, consignes).

Écris exactement deux sections :

"## Mode d'emploi : ce que l'épreuve attend et comment réviser"
- Si les informations pratiques décrivent l'évaluation (format, durée, date, type de sujet, critères), résume-les en 2 ou 3 phrases et dis quelle compétence l'épreuve vérifie. Sinon, écris une phrase prudente sur ce qu'un examen sur ce cours vérifiera probablement, sans inventer de date ni de format.
- « **Ce qui fait la différence :** » 4 ou 5 puces concrètes tirées du cours (nommer précisément les notions, citer auteur et date, relier les parties entre elles, utiliser les critères d'évaluation du cours s'il y en a).
- « **Méthode de révision recommandée :** » liste numérotée : 1. Comprendre (lire chaque partie en entier), 2. Rappel actif (cacher et réécrire les « À retenir »), 3. Espacement (J+1, J+3, J+7, voir le planning en fin de document), 4. Application (exercices ou cas concrets adaptés à ce cours), 5. Auto-test (questions de la dernière section).

"## Vue d'ensemble : la logique du cours"
- 2 ou 3 phrases : la grande question à laquelle tout le cours répond et comment les parties s'enchaînent.
- Un tableau Markdown : Partie | Question traitée | Idée clé (une ligne par partie).
- Une phrase « **Lecture :** » qui résume le fil rouge du cours.

${STYLE}`;

const FIN = `Tu écris la fin d'un « cours de révision » à partir des notes de révision de chaque partie.

Écris exactement ces sections, dans cet ordre :

"## Tableau de synthèse comparatif"
Un grand tableau Markdown qui compare les modèles, approches ou notions principales du cours sur les mêmes critères (par exemple : définition, auteurs, idée clé, avantages, limites). Choisis les lignes et colonnes les plus utiles pour ce cours.

"## Pièges à éviter"
5 à 7 puces : confusions fréquentes entre notions, oublis typiques, erreurs de raisonnement, tirées du contenu.

"## Auteurs, dates et idées à connaître"
Une phrase, puis un tableau Markdown : Auteur (date) | Idée clé | Partie. Uniquement les auteurs présents dans les notes, avec les dates données dans les notes.

"## Auto-évaluation et planning de révision"
- Une phrase : réponds à voix haute ou par écrit sans regarder ; coche quand tu as réussi deux fois à deux jours d'écart.
- "### Questions de rappel actif" : 15 à 25 questions qui couvrent tout le cours, chacune sur une ligne qui commence par "- [ ] " (définitions, distinctions, auteurs, étapes, « explique avec l'exemple de… »).
- "### Planning" : tableau Markdown Jour | Travail sur environ 7 jours (J1, J2, J3, J4, J5, J7, J9), qui répartit la lecture des parties, les rappels actifs, la refonte de mémoire du tableau de synthèse, un entraînement en conditions réelles et la révision des erreurs.

${STYLE}`;

export async function POST(req: Request) {
  try {
    const ctx = await context(req);
    const { kind = "partie", chapitre, n, contexte, plan, infos, notes, meta } = await req.json();
    let system: string;
    let user: string;
    if (kind === "partie") {
      if (typeof chapitre !== "string" || !chapitre.trim()) throw new HttpError(400, "Chapitre vide.");
      system = PARTIE(Number(n) || 1);
      const avant = Array.isArray(contexte) && contexte.length ? `Parties déjà écrites avant celle-ci : ${contexte.slice(-12).join(" | ")}\nSi ce chapitre prolonge, reprend ou nuance une partie précédente, commence (juste après le titre) par une ligne « **Lien avec ce qui précède :** » d'une ou deux phrases. Ne répète pas ce qui a déjà été expliqué : renvoie à la partie concernée.\n\n` : "";
      user = `${avant}Chapitre du cours :\n\n${chapitre.slice(0, 14000)}`;
    } else if (kind === "intro") {
      system = INTRO;
      user = `Plan et « À retenir » de chaque partie :\n${String(plan || "").slice(0, 9000)}\n\nInformations pratiques du cours (évaluation, consignes) :\n${String(infos || "aucune").slice(0, 4000)}`;
    } else if (kind === "fin") {
      system = FIN;
      user = `Notes de révision des parties :\n\n${String(notes || "").slice(0, 16000)}`;
    } else {
      throw new HttpError(400, "Type inconnu.");
    }
    const md = await smartChat(ctx, `${system}\n\n${String(meta || "")}`, user, { maxTokens: kind === "partie" ? 5000 : 4000, temperature: 0.3 });
    return NextResponse.json({ md: sansCadratin(md.trim()) });
  } catch (e) {
    return fail(e);
  }
}
