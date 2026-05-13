// One-off: lee data/fixtures.json y los inserta en Firestore (colección "matches").
// No pisa partidos cuyo `source === "manual"` (admin override).
//
// Requiere:
//   FIREBASE_SERVICE_ACCOUNT  → JSON del service account (pegado completo)
//   o un archivo service-account.json en la raíz del repo (ignorado por git)
//
// Uso:
//   npm i firebase-admin
//   node scripts/seed-fixtures.mjs

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadCredentials() {
  const env = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (env) return JSON.parse(env);
  return JSON.parse(readFileSync(join(ROOT, "service-account.json"), "utf-8"));
}

initializeApp({ credential: cert(loadCredentials()) });
const db = getFirestore();

const fixtures = JSON.parse(readFileSync(join(ROOT, "data/fixtures.json"), "utf-8"));

let written = 0, skipped = 0;
for (const f of fixtures) {
  const ref = db.collection("matches").doc(f.id);
  const existing = await ref.get();
  if (existing.exists && existing.data().source === "manual") {
    skipped++;
    continue;
  }
  const doc = {
    ...f,
    kickoff: Timestamp.fromDate(new Date(f.kickoff)),
    lastUpdated: FieldValue.serverTimestamp()
  };
  await ref.set(doc, { merge: true });
  written++;
}

// Config de scoring (idempotente)
await db.collection("config").doc("scoring").set({ exact: 3, winner: 1 }, { merge: true });

console.log(`Seeded ${written} fixtures (skipped ${skipped} manual overrides).`);
process.exit(0);
