// Trae resultados desde api-football (RapidAPI) y los escribe a Firestore.
// Se ejecuta desde GitHub Actions (workflow update-results.yml).
//
// Variables de entorno requeridas:
//   FIREBASE_SERVICE_ACCOUNT → JSON del service account (secret)
//   RAPIDAPI_KEY             → key de api-football en RapidAPI (secret)
//
// La identificación de partido entre la API y nuestros docs se hace por la tupla
// (homeTeamName, awayTeamName, date). Eso requiere que los nombres en fixtures.json
// estén alineados con los que devuelve la API una vez completado el sorteo.
// Mientras tanto el script logea "no match found" sin fallar.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const SVC = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!SVC) { console.error("FIREBASE_SERVICE_ACCOUNT no configurado."); process.exit(1); }
if (!RAPIDAPI_KEY) { console.warn("Sin RAPIDAPI_KEY: nada que hacer."); process.exit(0); }

initializeApp({ credential: cert(JSON.parse(SVC)) });
const db = getFirestore();

// api-football: World Cup league id = 1; season = año
const WC_LEAGUE_ID = 1;
const SEASON = 2026;

async function fetchApiMatches() {
  const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${WC_LEAGUE_ID}&season=${SEASON}`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
    }
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.response || [];
}

function statusOf(short) {
  if (["1H","2H","HT","ET","P","LIVE","BT"].includes(short)) return "live";
  if (["FT","AET","PEN","AWD","WO"].includes(short)) return "finished";
  return "scheduled";
}

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

async function loadOurMatches() {
  const snap = await db.collection("matches").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function findOurMatch(apiFix, ours) {
  const home = norm(apiFix.teams.home.name);
  const away = norm(apiFix.teams.away.name);
  const date = new Date(apiFix.fixture.date);
  return ours.find(m =>
    norm(m.home?.name) === home &&
    norm(m.away?.name) === away &&
    Math.abs(new Date(m.kickoff?.toDate ? m.kickoff.toDate() : m.kickoff) - date) < 24 * 3600 * 1000
  );
}

const ours = await loadOurMatches();
const apiMatches = await fetchApiMatches();
console.log(`API: ${apiMatches.length} fixtures · Local: ${ours.length}`);

let updated = 0, skipped = 0, unmatched = 0;
for (const fix of apiMatches) {
  const our = findOurMatch(fix, ours);
  if (!our) { unmatched++; continue; }
  if (our.source === "manual") { skipped++; continue; }

  const homeScore = fix.goals.home;
  const awayScore = fix.goals.away;
  const status = statusOf(fix.fixture.status.short);

  await db.collection("matches").doc(our.id).set({
    homeScore, awayScore, status,
    source: "api",
    lastUpdated: FieldValue.serverTimestamp()
  }, { merge: true });
  updated++;
}

console.log(`Updated: ${updated} · Skipped (manual): ${skipped} · Unmatched: ${unmatched}`);
process.exit(0);
