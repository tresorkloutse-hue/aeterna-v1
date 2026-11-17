// Polymatch : essai des identifiants SMTP, hors de Supabase.
//
// A quoi ca sert. Quand Supabase repond « Error sending confirmation email »
// avec l erreur 535, c est le serveur de courrier qui refuse le couple
// identifiant / cle. Ce script fait la meme demande de connexion, tout seul, et
// dit si elle est acceptee. Il n envoie aucun message et n ecrit rien sur le
// disque : les valeurs saisies restent en memoire le temps de l essai.
//
// Les valeurs saisies s affichent a l ecran : ferme l onglet du terminal apres l essai.
//
// Usage, dans un terminal, depuis le dossier du depot :
//   node outils/essai-smtp.js
//
// Aucune dependance a installer.

const net = require("net");
const tls = require("tls");
const readline = require("readline");

const HOTE = "smtp-relay.brevo.com";
const PORT = 587;

// Une seule interface de lecture pour les deux questions : en creer une par
// question ferait perdre la seconde ligne quand l entree arrive d un seul coup.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function demander(question) {
  return new Promise((resoudre) => rl.question(question, (v) => resoudre(String(v).trim())));
}

// Lecture des reponses du serveur. Une reponse peut arriver en plusieurs
// morceaux, et tenir sur plusieurs lignes : seule la derniere porte un espace
// apres le code (250 fin), les precedentes un tiret (250-suite). On garde donc
// ce qui arrive dans un tampon jusqu a voir cette derniere ligne.
function dialogue(socket) {
  let tampon = "";
  const files = [];

  function vider() {
    while (files.length) {
      const lignes = tampon.split(/\r\n/).filter(Boolean);
      if (!lignes.length || !/^\d{3} /.test(lignes[lignes.length - 1])) return;
      tampon = "";
      files.shift()(lignes.join(" | "));
    }
  }

  socket.on("data", (d) => { tampon += d.toString("utf8"); vider(); });

  return {
    envoyer(ligne) {
      const p = new Promise((r) => files.push(r));
      socket.write(ligne + "\r\n");
      vider();
      return p;
    },
    attendre() {
      const p = new Promise((r) => files.push(r));
      vider();
      return p;
    }
  };
}

(async function () {
  console.log("\nEssai de connexion a " + HOTE + ":" + PORT + "\n");
  console.log("L identifiant et la cle se trouvent chez Brevo, dans SMTP & API, onglet SMTP.");
  console.log("La cle SMTP commence par xsmtpsib- ; une cle qui commence par xkeysib- est une cle d API,");
  console.log("elle ne marche pas ici.\n");

  const login = await demander("Identifiant SMTP : ");
  const cle = await demander("Cle SMTP : ");
  rl.close();

  if (!login || !cle) { console.log("\nIl manque une valeur, essai abandonne."); process.exit(1); }
  if (/^xkeysib-/.test(cle)) {
    console.log("\nCette cle commence par xkeysib- : c est la cle d API, pas la cle SMTP.");
    console.log("Genere une cle SMTP chez Brevo, onglet SMTP, bouton Generate a new SMTP key.\n");
    process.exit(1);
  }

  const brut = net.connect(PORT, HOTE);
  brut.setTimeout(15000);
  brut.on("timeout", () => { console.log("\nLe serveur ne repond pas. Verifie ta connexion ou le port.\n"); process.exit(1); });
  brut.on("error", (e) => { console.log("\nConnexion impossible : " + e.message + "\n"); process.exit(1); });

  const clair = dialogue(brut);
  await clair.attendre();
  await clair.envoyer("EHLO polymatch.local");
  const rep = await clair.envoyer("STARTTLS");
  if (!/^220/.test(rep)) { console.log("\nLe serveur refuse le chiffrement : " + rep + "\n"); process.exit(1); }

  const sur = tls.connect({ socket: brut, servername: HOTE });
  sur.on("error", (e) => { console.log("\nChiffrement impossible : " + e.message + "\n"); process.exit(1); });
  await new Promise((r) => sur.once("secureConnect", r));

  const chiffre = dialogue(sur);
  await chiffre.envoyer("EHLO polymatch.local");
  const debut = await chiffre.envoyer("AUTH LOGIN");
  if (!/^334/.test(debut)) { console.log("\nLe serveur n accepte pas cette methode : " + debut + "\n"); process.exit(1); }
  await chiffre.envoyer(Buffer.from(login, "utf8").toString("base64"));
  const verdict = await chiffre.envoyer(Buffer.from(cle, "utf8").toString("base64"));
  sur.write("QUIT\r\n");

  console.log("");
  if (/^235/.test(verdict)) {
    console.log("Identifiants acceptes. Le couple identifiant / cle est bon.");
    console.log("Si Supabase echoue encore, c est qu une des deux valeurs y est mal recopiee,");
    console.log("le plus souvent une espace collee au debut ou a la fin.\n");
  } else if (/^535/.test(verdict)) {
    console.log("Refuses : " + verdict);
    console.log("C est bien le couple identifiant / cle qui ne convient pas, pas Supabase.");
    console.log("Reprends l identifiant affiche dans l onglet SMTP et genere une nouvelle cle.\n");
  } else {
    console.log("Reponse inattendue du serveur : " + verdict + "\n");
  }
  process.exit(0);
})();
