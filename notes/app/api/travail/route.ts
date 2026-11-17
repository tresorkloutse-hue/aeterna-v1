import { NextResponse } from "next/server";
import { context, smartChat, fail, HttpError, sansCadratin } from "@/lib/server";

export const maxDuration = 120;

const PROMPT = `Tu aides un étudiant à préparer un travail universitaire (dossier, exposé, devoir, analyse, mémoire…) pour une UE. Tu reçois la consigne, des extraits des documents qu'il a joints et des extraits de ses cours de l'UE.

Écris exactement ces sections, en Markdown :

"## Ce qu'on te demande"
Type de travail, sujet reformulé simplement, attendus explicites et implicites, critères d'évaluation s'ils sont donnés, longueur ou format, et les mots de la consigne à ne pas négliger.

"## Problématiques possibles"
2 ou 3 problématiques formulées comme des questions, chacune avec une phrase sur l'angle qu'elle donne. Indique celle que tu conseilles et pourquoi.

"## Plan détaillé proposé"
Un plan pour la problématique conseillée : introduction (accroche, définitions, problématique, annonce du plan), puis parties "### I.", "### II." (et "### III." si pertinent) avec des sous-parties A, B. Pour chaque sous-partie : l'idée défendue, les arguments, les exemples, et les sources à utiliser entre crochets, par exemple [Doc : nom du document] ou [Cours : titre de la séance]. Puis conclusion (réponse à la problématique, ouverture).

"## Pistes et idées à exploiter"
Puces concrètes tirées des documents et des cours : citations ou chiffres à reprendre, exemples, cas, contre-arguments, avec leur source entre crochets.

"## Notions et auteurs du cours à mobiliser"
Tableau Markdown : Notion ou auteur (date) | Ce que ça apporte au travail | Où l'utiliser dans le plan.

"## Méthode et étapes"
Étapes numérotées pour réaliser le travail ; si une échéance est donnée, répartis-les jusqu'à cette date.

"## Check-list avant de rendre"
6 à 10 cases à cocher, chacune sur une ligne qui commence par "- [ ] ".

Règles : reste fidèle aux documents et aux cours, n'invente ni source, ni auteur, ni chiffre. Si tu proposes une idée qui ne vient pas des sources, écris-la « (piste personnelle) ». Si la consigne est vague, dis ce qu'il faudrait demander à l'enseignant. Français clair, phrases courtes. N'utilise jamais de tiret cadratin (—).`;

export async function POST(req: Request) {
  try {
    const ctx = await context(req);
    const { titre, ue, consigne, echeance, docs, cours, consigneSup } = await req.json();
    if (!String(consigne || "").trim() && !String(docs || "").trim()) throw new HttpError(400, "Ajoute la consigne ou au moins un document.");
    const user =
      `UE : ${ue || ""}\nTitre du travail : ${titre || "sans titre"}\n${echeance ? `Échéance : ${echeance}\n` : ""}` +
      `\nConsigne :\n${String(consigne || "(pas de consigne écrite, déduis-la des documents)").slice(0, 4000)}\n` +
      (consigneSup ? `\nDemande particulière de l'étudiant pour cette version : ${String(consigneSup).slice(0, 800)}\n` : "") +
      `\nExtraits des documents joints :\n${String(docs || "aucun").slice(0, 9000)}\n` +
      `\nExtraits des cours de l'UE :\n${String(cours || "aucun").slice(0, 6000)}`;
    const md = await smartChat(ctx, PROMPT, user, { maxTokens: 5000, temperature: 0.4 });
    return NextResponse.json({ md: sansCadratin(md.trim()) });
  } catch (e) {
    return fail(e);
  }
}
