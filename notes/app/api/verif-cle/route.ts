import { NextResponse } from "next/server";
import { fail, HttpError, verifierCle, SECOURS, Fournisseur } from "@/lib/server";

export async function POST(req: Request) {
  try {
    const { fournisseur, key } = await req.json();
    if (!(fournisseur in SECOURS)) throw new HttpError(400, "Fournisseur inconnu.");
    if (typeof key !== "string" || key.trim().length < 10) throw new HttpError(400, "Clé trop courte.");
    await verifierCle(fournisseur as Fournisseur, key.trim());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
