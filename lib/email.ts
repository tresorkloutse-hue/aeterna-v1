/**
 * HERMES v2 — Templates email AETERNA Liens Trophées
 */

const PLAN_LABELS: Record<string, string> = {
  essence: 'Essence', heritage: 'Héritage', diamond: 'Diamond',
}
const PLAN_GLYPHS: Record<string, string> = {
  essence: '◈', heritage: '✦', diamond: '◉',
}

function base(content: string, year = new Date().getFullYear()): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#020f09;font-family:Georgia,serif;color:#F7F2EC;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:60px 20px;">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;">
  <tr><td align="center" style="padding-bottom:44px;">
    <span style="font-family:sans-serif;font-size:10px;letter-spacing:.4em;color:rgba(224,196,180,.35);">AETERNA</span>
  </td></tr>
  ${content}
  <tr><td align="center" style="padding-top:44px;border-top:1px solid rgba(224,196,180,.07);">
    <p style="font-family:sans-serif;font-size:9px;color:rgba(247,242,236,.12);letter-spacing:.1em;margin:0;">
      AETERNA CORP · Mémoire Durable · ${year}
    </p>
  </td></tr>
</table></td></tr></table></body></html>`
}

function cta(href: string, label: string, accent = '#E0C4B4'): string {
  return `<tr><td align="center" style="padding:44px 0 28px;">
    <a href="${href}" style="display:inline-block;padding:16px 52px;border:1px solid ${accent};color:${accent};font-family:sans-serif;font-size:10px;letter-spacing:.35em;text-transform:uppercase;text-decoration:none;">
      ${label}
    </a>
  </td></tr>`
}

function ecoBadge(trees: number): string {
  return `<tr><td align="center" style="padding-bottom:32px;">
    <span style="display:inline-flex;align-items:center;gap:10px;padding:9px 18px;border:1px solid rgba(6,81,47,.5);background:rgba(6,81,47,.1);">
      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#4ade80;"></span>
      <span style="font-family:sans-serif;font-size:9px;letter-spacing:.15em;color:rgba(247,242,236,.4);text-transform:uppercase;">
        <strong style="color:#4ade80;font-weight:300;">${trees} arbres plantés</strong> · 200% compensation CO₂ · EcoTree
      </span>
    </span>
  </td></tr>`
}

// ─── Email destinataire : ouverture du sanctuaire ────────────────
export function recipientEmail({
  recipientName, senderName, plan, experienceUrl, trees = 2,
}: {
  recipientName: string; senderName: string; plan: string
  experienceUrl: string; trees?: number
}): string {
  const label = PLAN_LABELS[plan] ?? plan
  const glyph = PLAN_GLYPHS[plan] ?? '◈'
  const accentColor = plan === 'diamond' ? '#c4b0e8' : '#E0C4B4'

  return base(`
  <tr><td align="center" style="padding-bottom:44px;">
    <span style="font-size:40px;color:${accentColor};opacity:.6;">${glyph}</span>
  </td></tr>
  <tr><td align="center" style="padding-bottom:44px;">
    <h1 style="font-size:44px;font-weight:300;font-style:italic;color:#F7F2EC;margin:0;line-height:1.05;">
      ${recipientName},
    </h1>
  </td></tr>
  <tr><td style="background:rgba(6,57,39,.25);border:1px solid rgba(224,196,180,.1);padding:36px;margin-bottom:36px;">
    <p style="font-size:15px;font-style:italic;color:rgba(247,242,236,.8);line-height:1.85;margin:0 0 14px;">
      <strong style="color:${accentColor};font-weight:400;">${senderName}</strong>
      vous a ouvert un sanctuaire éternel — <em>Protocole ${label}</em>.
    </p>
    <p style="font-size:13px;color:rgba(247,242,236,.38);line-height:1.75;margin:0;">
      Ce sanctuaire vous est dédié. Il ne connaît ni l'usure, ni l'oubli.
    </p>
  </td></tr>
  ${cta(experienceUrl, 'Ouvrir mon sanctuaire', accentColor)}
  ${ecoBadge(trees)}
  `)
}

// ─── Confirmation expéditeur ─────────────────────────────────────
export function senderEmail({
  senderName, recipientName, plan, experienceUrl, trees = 2,
}: {
  senderName: string; recipientName: string; plan: string
  experienceUrl: string; trees?: number
}): string {
  const label = PLAN_LABELS[plan] ?? plan

  return base(`
  <tr><td align="center" style="padding-bottom:44px;">
    <h1 style="font-size:38px;font-weight:300;font-style:italic;color:#F7F2EC;margin:0;line-height:1.1;">
      ${senderName},<br>votre sanctuaire est gravé.
    </h1>
  </td></tr>
  <tr><td style="background:rgba(6,57,39,.25);border:1px solid rgba(224,196,180,.1);padding:36px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding-bottom:12px;border-bottom:1px solid rgba(224,196,180,.08);font-family:sans-serif;font-size:9px;letter-spacing:.25em;text-transform:uppercase;color:rgba(224,196,180,.35);">
        Protocole <span style="float:right;color:#E0C4B4;">${label}</span>
      </td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid rgba(224,196,180,.08);font-family:sans-serif;font-size:9px;letter-spacing:.25em;text-transform:uppercase;color:rgba(224,196,180,.35);">
        Destinataire <span style="float:right;color:rgba(247,242,236,.65);">${recipientName}</span>
      </td></tr>
      <tr><td style="padding-top:12px;font-family:sans-serif;font-size:9px;letter-spacing:.25em;text-transform:uppercase;color:rgba(224,196,180,.35);">
        Archivage <span style="float:right;color:rgba(247,242,236,.65);">Éternel</span>
      </td></tr>
    </table>
  </td></tr>
  ${cta(experienceUrl, "Voir le sanctuaire")}
  <tr><td align="center" style="padding-bottom:28px;">
    <p style="font-family:sans-serif;font-size:11px;color:rgba(247,242,236,.22);line-height:1.85;margin:0;letter-spacing:.03em;">
      Ce lien peut être partagé à tout moment avec ${recipientName}.<br>
      Accès garanti à vie — sans abonnement.
    </p>
  </td></tr>
  ${ecoBadge(trees)}
  `)
}

// ─── Welcome Diamond ─────────────────────────────────────────────
export function diamondWelcomeEmail({
  name, portalUrl,
}: { name: string; portalUrl: string }): string {
  return base(`
  <tr><td align="center" style="padding-bottom:44px;">
    <span style="font-size:44px;color:rgba(196,176,232,.6);">◉</span>
  </td></tr>
  <tr><td align="center" style="padding-bottom:44px;">
    <h1 style="font-size:38px;font-weight:300;font-style:italic;color:#F7F2EC;margin:0;">
      Bienvenue dans Diamond,<br><em style="color:#c4b0e8;">${name}</em>
    </h1>
  </td></tr>
  <tr><td style="background:rgba(2,4,20,.6);border:1px solid rgba(180,160,224,.2);padding:36px;">
    <p style="font-size:14px;color:rgba(247,242,236,.65);line-height:1.85;margin:0 0 14px;">
      Votre coffre-fort numérique privé est actif. Vous disposez de <strong style="color:#c4b0e8;font-weight:400;">7 jours d'essai</strong> offerts.
    </p>
    <p style="font-size:12px;color:rgba(247,242,236,.35);line-height:1.75;margin:0;">
      Créez vos premiers sanctuaires illimités, uploadez audio et vidéo 4K, et accédez à votre tableau de bord privé.
    </p>
  </td></tr>
  ${cta(portalUrl, 'Accéder à mon espace Diamond', '#c4b0e8')}
  `)
}
