// Genera data/fixtures.json con los 104 partidos del Mundial 2026.
// Equipos reales según sorteo de FIFA del 5-dic-2025 + playoffs marzo 2026.
//
// Uso: node scripts/generate-fixtures.mjs

import { writeFileSync } from "node:fs";

// Equipos por grupo, en orden de "siembra" (1 = cabeza de serie / anfitrión).
// La numeración 1..4 se mapea a los slots de los partidos.
const TEAMS = {
  A: [
    { code: "MEX", name: "México",            flag: "🇲🇽" },
    { code: "RSA", name: "Sudáfrica",         flag: "🇿🇦" },
    { code: "KOR", name: "Corea del Sur",     flag: "🇰🇷" },
    { code: "CZE", name: "Chequia",           flag: "🇨🇿" }
  ],
  B: [
    { code: "CAN", name: "Canadá",            flag: "🇨🇦" },
    { code: "BIH", name: "Bosnia y H.",       flag: "🇧🇦" },
    { code: "QAT", name: "Qatar",             flag: "🇶🇦" },
    { code: "SUI", name: "Suiza",             flag: "🇨🇭" }
  ],
  C: [
    { code: "BRA", name: "Brasil",            flag: "🇧🇷" },
    { code: "MAR", name: "Marruecos",         flag: "🇲🇦" },
    { code: "HAI", name: "Haití",             flag: "🇭🇹" },
    { code: "SCO", name: "Escocia",           flag: "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}" }
  ],
  D: [
    { code: "USA", name: "Estados Unidos",    flag: "🇺🇸" },
    { code: "PAR", name: "Paraguay",          flag: "🇵🇾" },
    { code: "AUS", name: "Australia",         flag: "🇦🇺" },
    { code: "TUR", name: "Turquía",           flag: "🇹🇷" }
  ],
  E: [
    { code: "GER", name: "Alemania",          flag: "🇩🇪" },
    { code: "CUW", name: "Curazao",           flag: "🇨🇼" },
    { code: "CIV", name: "Costa de Marfil",   flag: "🇨🇮" },
    { code: "ECU", name: "Ecuador",           flag: "🇪🇨" }
  ],
  F: [
    { code: "NED", name: "Países Bajos",      flag: "🇳🇱" },
    { code: "JPN", name: "Japón",             flag: "🇯🇵" },
    { code: "SWE", name: "Suecia",            flag: "🇸🇪" },
    { code: "TUN", name: "Túnez",             flag: "🇹🇳" }
  ],
  G: [
    { code: "BEL", name: "Bélgica",           flag: "🇧🇪" },
    { code: "EGY", name: "Egipto",            flag: "🇪🇬" },
    { code: "IRN", name: "Irán",              flag: "🇮🇷" },
    { code: "NZL", name: "Nueva Zelanda",     flag: "🇳🇿" }
  ],
  H: [
    { code: "ESP", name: "España",            flag: "🇪🇸" },
    { code: "CPV", name: "Cabo Verde",        flag: "🇨🇻" },
    { code: "KSA", name: "Arabia Saudita",    flag: "🇸🇦" },
    { code: "URU", name: "Uruguay",           flag: "🇺🇾" }
  ],
  I: [
    { code: "FRA", name: "Francia",           flag: "🇫🇷" },
    { code: "SEN", name: "Senegal",           flag: "🇸🇳" },
    { code: "IRQ", name: "Irak",              flag: "🇮🇶" },
    { code: "NOR", name: "Noruega",           flag: "🇳🇴" }
  ],
  J: [
    { code: "ARG", name: "Argentina",         flag: "🇦🇷" },
    { code: "ALG", name: "Argelia",           flag: "🇩🇿" },
    { code: "AUT", name: "Austria",           flag: "🇦🇹" },
    { code: "JOR", name: "Jordania",          flag: "🇯🇴" }
  ],
  K: [
    { code: "POR", name: "Portugal",          flag: "🇵🇹" },
    { code: "COD", name: "RD del Congo",      flag: "🇨🇩" },
    { code: "UZB", name: "Uzbekistán",        flag: "🇺🇿" },
    { code: "COL", name: "Colombia",          flag: "🇨🇴" }
  ],
  L: [
    { code: "ENG", name: "Inglaterra",        flag: "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
    { code: "CRO", name: "Croacia",           flag: "🇭🇷" },
    { code: "GHA", name: "Ghana",             flag: "🇬🇭" },
    { code: "PAN", name: "Panamá",            flag: "🇵🇦" }
  ]
};

const HOST_CITIES = [
  "Ciudad de México", "Guadalajara", "Monterrey",
  "Toronto", "Vancouver",
  "Atlanta", "Boston", "Dallas", "Houston", "Kansas City",
  "Los Ángeles", "Miami", "Nueva York/Nueva Jersey",
  "Philadelphia", "San Francisco Bay Area", "Seattle"
];

function teamOf(group, slot) {
  return { ...TEAMS[group][slot - 1] };
}

const fixtures = [];
let idCounter = 1;

// ---------- FASE DE GRUPOS (72 partidos) ----------
const groupRounds = [
  ["1v2", "3v4"],
  ["1v3", "2v4"],
  ["4v1", "2v3"]
];

const GROUP_START = new Date("2026-06-11T00:00:00-05:00");
let dayOffset = 0;
let matchOfDay = 0;

function nextKickoff() {
  const slots = ["13:00", "16:00", "19:00", "22:00"];
  if (matchOfDay >= slots.length) { dayOffset++; matchOfDay = 0; }
  const day = new Date(GROUP_START);
  day.setUTCDate(day.getUTCDate() + dayOffset);
  const time = slots[matchOfDay++];
  const [h, m] = time.split(":");
  return `${day.toISOString().slice(0,10)}T${h}:${m}:00-03:00`;
}

const GROUPS = Object.keys(TEAMS);

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
        venue: HOST_CITIES[(idCounter * 7) % HOST_CITIES.length],
        home: teamOf(g, a),
        away: teamOf(g, b),
        homeScore: null,
        awayScore: null,
        status: "scheduled",
        source: null
      });
    }
  }
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
    venue: HOST_CITIES[venueIdx % HOST_CITIES.length],
    home: { code: `${stage}-${label}-H`, name: `Por definir`, flag: "⚽" },
    away: { code: `${stage}-${label}-A`, name: `Por definir`, flag: "⚽" },
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    source: null
  });
}

// 32avos (16): 28-jun a 3-jul
const R32_START = new Date("2026-06-28T00:00:00-05:00");
for (let i = 0; i < 16; i++) {
  const day = new Date(R32_START); day.setUTCDate(day.getUTCDate() + Math.floor(i / 3));
  const time = ["16:00","19:00","22:00"][i % 3];
  knockoutSlot("r32", String(i+1).padStart(2,"0"), `${day.toISOString().slice(0,10)}T${time}:00-03:00`, i);
}

// Octavos (8): 4-jul a 7-jul
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
knockoutSlot("sf", "01", "2026-07-14T21:00:00-03:00", 12);
knockoutSlot("sf", "02", "2026-07-15T21:00:00-03:00", 5);

// 3er puesto: 18-jul
knockoutSlot("third", "01", "2026-07-18T17:00:00-03:00", 11);

// Final: 19-jul, MetLife Stadium (NY/NJ)
knockoutSlot("final", "01", "2026-07-19T16:00:00-03:00", 12);

fixtures.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

console.log(`Generated ${fixtures.length} fixtures`);
writeFileSync(
  new URL("../data/fixtures.json", import.meta.url),
  JSON.stringify(fixtures, null, 2)
);
console.log("→ data/fixtures.json");
