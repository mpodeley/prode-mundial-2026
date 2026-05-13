// Genera data/fixtures.json con los 104 partidos del Mundial 2026.
// Los equipos son placeholders (A1, A2, ...) — reemplazá con los reales después del sorteo
// (5-dic-2025) editando el JSON o ejecutando este script con un mapping de equipos.
//
// Uso: node scripts/generate-fixtures.mjs > data/fixtures.json

import { writeFileSync } from "node:fs";

const GROUPS = "ABCDEFGHIJKL".split("");
const HOST_CITIES = [
  { name: "Mexico City", country: "MX" },
  { name: "Guadalajara", country: "MX" },
  { name: "Monterrey", country: "MX" },
  { name: "Toronto", country: "CA" },
  { name: "Vancouver", country: "CA" },
  { name: "Atlanta", country: "US" },
  { name: "Boston", country: "US" },
  { name: "Dallas", country: "US" },
  { name: "Houston", country: "US" },
  { name: "Kansas City", country: "US" },
  { name: "Los Angeles", country: "US" },
  { name: "Miami", country: "US" },
  { name: "New York/New Jersey", country: "US" },
  { name: "Philadelphia", country: "US" },
  { name: "San Francisco Bay Area", country: "US" },
  { name: "Seattle", country: "US" }
];

// Bandera-emoji por código de equipo (placeholder genérico; reemplazar al cargar equipos reales)
function teamOf(group, slot) {
  return {
    code: `${group}${slot}`,
    name: `Equipo ${group}${slot}`,
    flag: "⚽"
  };
}

function dt(iso) { return new Date(iso).toISOString(); }

const fixtures = [];
let idCounter = 1;

// ---------- FASE DE GRUPOS (72 partidos) ----------
// 3 jornadas, 2 partidos por grupo por jornada.
// Pares por jornada: J1: 1v2, 3v4 · J2: 1v3, 2v4 · J3: 4v1, 2v3 (último simultáneo)
const groupRounds = [
  ["1v2", "3v4"],
  ["1v3", "2v4"],
  ["4v1", "2v3"]
];

// 12 grupos × 3 jornadas = 36 "slots de jornada". Distribuimos a lo largo de
// 17 días (11-jun a 27-jun) con ~2-4 partidos por día.
const GROUP_START = new Date("2026-06-11T00:00:00-05:00");
const SLOTS_PER_DAY = [12,12,12,11,11,11,10]; // ritmo simbólico, lo importante es que esté ordenado

let dayOffset = 0;
let matchOfDay = 0;

function nextKickoff() {
  // 4 horarios por día: 12:00, 15:00, 18:00, 21:00 hora local (UTC-5 promedio)
  const slots = ["13:00", "16:00", "19:00", "22:00"];
  if (matchOfDay >= slots.length) { dayOffset++; matchOfDay = 0; }
  const day = new Date(GROUP_START);
  day.setUTCDate(day.getUTCDate() + dayOffset);
  const time = slots[matchOfDay++];
  const [h, m] = time.split(":");
  // Usamos UTC-4 como referencia "Buenos Aires" — los venues están en CDMX/USA pero
  // mostramos la hora en AR. El generador deja el ISO y la UI formatea.
  return `${day.toISOString().slice(0,10)}T${h}:${m}:00-03:00`;
}

for (let jornada = 0; jornada < 3; jornada++) {
  for (const g of GROUPS) {
    for (const pairing of groupRounds[jornada]) {
      const [a, b] = pairing.split("v").map(Number);
      fixtures.push({
        id: `M-${String(idCounter++).padStart(3, "0")}`,
        stage: "group",
        group: g,
        matchday: jornada + 1,
        kickoff: nextKickoff(),
        venue: HOST_CITIES[(idCounter * 7) % HOST_CITIES.length].name,
        home: teamOf(g, a),
        away: teamOf(g, b),
        homeScore: null,
        awayScore: null,
        status: "scheduled",
        source: null
      });
    }
  }
  // Avanzar de día entre jornadas para evitar superposición
  dayOffset = Math.max(dayOffset + 1, [6, 12, 17][jornada]);
  matchOfDay = 0;
}

// ---------- ELIMINATORIAS (32 partidos) ----------
function knockoutSlot(stage, label, kickoffISO, venueIdx) {
  fixtures.push({
    id: `K-${stage}-${label}`,
    stage,
    matchday: null,
    kickoff: kickoffISO,
    venue: HOST_CITIES[venueIdx % HOST_CITIES.length].name,
    home: { code: `${stage}-${label}-H`, name: `Por definir`, flag: "⚽" },
    away: { code: `${stage}-${label}-A`, name: `Por definir`, flag: "⚽" },
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    source: null
  });
}

// 32avos (16 partidos): 28-jun a 3-jul
const R32_START = new Date("2026-06-28T00:00:00-05:00");
for (let i = 0; i < 16; i++) {
  const day = new Date(R32_START); day.setUTCDate(day.getUTCDate() + Math.floor(i / 3));
  const time = ["16:00","19:00","22:00"][i % 3];
  knockoutSlot("r32", String(i+1).padStart(2,"0"), `${day.toISOString().slice(0,10)}T${time}:00-03:00`, i);
}

// 16avos (8 partidos): 4-jul a 7-jul
const R16_START = new Date("2026-07-04T00:00:00-05:00");
for (let i = 0; i < 8; i++) {
  const day = new Date(R16_START); day.setUTCDate(day.getUTCDate() + Math.floor(i / 2));
  const time = ["18:00","22:00"][i % 2];
  knockoutSlot("r16", String(i+1).padStart(2,"0"), `${day.toISOString().slice(0,10)}T${time}:00-03:00`, i);
}

// Cuartos (4): 9-jul, 11-jul
const QF_DATES = ["2026-07-09","2026-07-09","2026-07-11","2026-07-11"];
for (let i = 0; i < 4; i++) {
  const time = i % 2 === 0 ? "18:00" : "22:00";
  knockoutSlot("qf", String(i+1).padStart(2,"0"), `${QF_DATES[i]}T${time}:00-03:00`, i);
}

// Semis (2): 14-jul, 15-jul
knockoutSlot("sf", "01", "2026-07-14T21:00:00-03:00", 12); // Dallas
knockoutSlot("sf", "02", "2026-07-15T21:00:00-03:00", 5);  // Atlanta

// 3er puesto: 18-jul
knockoutSlot("third", "01", "2026-07-18T17:00:00-03:00", 11); // Miami

// Final: 19-jul, MetLife Stadium (NY/NJ)
knockoutSlot("final", "01", "2026-07-19T16:00:00-03:00", 12);  // NY/NJ

// Ordenar por kickoff
fixtures.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

console.log(`Generated ${fixtures.length} fixtures`);
writeFileSync(
  new URL("../data/fixtures.json", import.meta.url),
  JSON.stringify(fixtures, null, 2)
);
console.log("→ data/fixtures.json");
