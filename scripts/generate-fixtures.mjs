// Genera data/fixtures.json con los 104 partidos del Mundial 2026.
// Equipos reales según sorteo de FIFA del 5-dic-2025 + playoffs marzo 2026.
//
// Uso: node scripts/generate-fixtures.mjs

import { writeFileSync } from "node:fs";

// Equipos por grupo. iso = ISO 3166-1 alpha-2 (para flagcdn.com).
const TEAMS = {
  A: [
    { code: "MEX", iso: "mx",    name: "México" },
    { code: "RSA", iso: "za",    name: "Sudáfrica" },
    { code: "KOR", iso: "kr",    name: "Corea del Sur" },
    { code: "CZE", iso: "cz",    name: "Chequia" }
  ],
  B: [
    { code: "CAN", iso: "ca",    name: "Canadá" },
    { code: "BIH", iso: "ba",    name: "Bosnia y H." },
    { code: "QAT", iso: "qa",    name: "Qatar" },
    { code: "SUI", iso: "ch",    name: "Suiza" }
  ],
  C: [
    { code: "BRA", iso: "br",    name: "Brasil" },
    { code: "MAR", iso: "ma",    name: "Marruecos" },
    { code: "HAI", iso: "ht",    name: "Haití" },
    { code: "SCO", iso: "gb-sct", name: "Escocia" }
  ],
  D: [
    { code: "USA", iso: "us",    name: "Estados Unidos" },
    { code: "PAR", iso: "py",    name: "Paraguay" },
    { code: "AUS", iso: "au",    name: "Australia" },
    { code: "TUR", iso: "tr",    name: "Turquía" }
  ],
  E: [
    { code: "GER", iso: "de",    name: "Alemania" },
    { code: "CUW", iso: "cw",    name: "Curazao" },
    { code: "CIV", iso: "ci",    name: "Costa de Marfil" },
    { code: "ECU", iso: "ec",    name: "Ecuador" }
  ],
  F: [
    { code: "NED", iso: "nl",    name: "Países Bajos" },
    { code: "JPN", iso: "jp",    name: "Japón" },
    { code: "SWE", iso: "se",    name: "Suecia" },
    { code: "TUN", iso: "tn",    name: "Túnez" }
  ],
  G: [
    { code: "BEL", iso: "be",    name: "Bélgica" },
    { code: "EGY", iso: "eg",    name: "Egipto" },
    { code: "IRN", iso: "ir",    name: "Irán" },
    { code: "NZL", iso: "nz",    name: "Nueva Zelanda" }
  ],
  H: [
    { code: "ESP", iso: "es",    name: "España" },
    { code: "CPV", iso: "cv",    name: "Cabo Verde" },
    { code: "KSA", iso: "sa",    name: "Arabia Saudita" },
    { code: "URU", iso: "uy",    name: "Uruguay" }
  ],
  I: [
    { code: "FRA", iso: "fr",    name: "Francia" },
    { code: "SEN", iso: "sn",    name: "Senegal" },
    { code: "IRQ", iso: "iq",    name: "Irak" },
    { code: "NOR", iso: "no",    name: "Noruega" }
  ],
  J: [
    { code: "ARG", iso: "ar",    name: "Argentina" },
    { code: "ALG", iso: "dz",    name: "Argelia" },
    { code: "AUT", iso: "at",    name: "Austria" },
    { code: "JOR", iso: "jo",    name: "Jordania" }
  ],
  K: [
    { code: "POR", iso: "pt",    name: "Portugal" },
    { code: "COD", iso: "cd",    name: "RD del Congo" },
    { code: "UZB", iso: "uz",    name: "Uzbekistán" },
    { code: "COL", iso: "co",    name: "Colombia" }
  ],
  L: [
    { code: "ENG", iso: "gb-eng", name: "Inglaterra" },
    { code: "CRO", iso: "hr",    name: "Croacia" },
    { code: "GHA", iso: "gh",    name: "Ghana" },
    { code: "PAN", iso: "pa",    name: "Panamá" }
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

function placeholderTeam(label) {
  return { code: label, iso: null, name: label };
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
// Estructura del bracket (para visualización en árbol):
//   r16-N ← r32-(2N-1) y r32-(2N)
//   qf-N  ← r16-(2N-1) y r16-(2N)
//   sf-N  ← qf-(2N-1) y qf-(2N)
//   final ← sf-01 y sf-02
//   third ← perdedor sf-01 vs perdedor sf-02
function knockoutSlot(stage, label, kickoffISO, venueIdx, sources = null) {
  fixtures.push({
    id: `K-${stage}-${label}`,
    stage,
    bracketIndex: parseInt(label, 10),
    sources, // ids de los partidos cuyos ganadores llegan acá
    kickoff: kickoffISO,
    venue: HOST_CITIES[venueIdx % HOST_CITIES.length],
    home: placeholderTeam("Por definir"),
    away: placeholderTeam("Por definir"),
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    source: null
  });
}

const R32_START = new Date("2026-06-28T00:00:00-05:00");
for (let i = 0; i < 16; i++) {
  const day = new Date(R32_START); day.setUTCDate(day.getUTCDate() + Math.floor(i / 3));
  const time = ["16:00","19:00","22:00"][i % 3];
  knockoutSlot("r32", String(i+1).padStart(2,"0"), `${day.toISOString().slice(0,10)}T${time}:00-03:00`, i);
}

const R16_START = new Date("2026-07-04T00:00:00-05:00");
for (let i = 0; i < 8; i++) {
  const day = new Date(R16_START); day.setUTCDate(day.getUTCDate() + Math.floor(i / 2));
  const time = ["18:00","22:00"][i % 2];
  const sources = [
    `K-r32-${String(2*i+1).padStart(2,"0")}`,
    `K-r32-${String(2*i+2).padStart(2,"0")}`
  ];
  knockoutSlot("r16", String(i+1).padStart(2,"0"), `${day.toISOString().slice(0,10)}T${time}:00-03:00`, i, sources);
}

const QF_DATES = ["2026-07-09","2026-07-09","2026-07-11","2026-07-11"];
for (let i = 0; i < 4; i++) {
  const time = i % 2 === 0 ? "18:00" : "22:00";
  const sources = [
    `K-r16-${String(2*i+1).padStart(2,"0")}`,
    `K-r16-${String(2*i+2).padStart(2,"0")}`
  ];
  knockoutSlot("qf", String(i+1).padStart(2,"0"), `${QF_DATES[i]}T${time}:00-03:00`, i, sources);
}

knockoutSlot("sf", "01", "2026-07-14T21:00:00-03:00", 12, ["K-qf-01", "K-qf-02"]);
knockoutSlot("sf", "02", "2026-07-15T21:00:00-03:00", 5,  ["K-qf-03", "K-qf-04"]);
knockoutSlot("third", "01", "2026-07-18T17:00:00-03:00", 11, ["K-sf-01", "K-sf-02"]);
knockoutSlot("final", "01", "2026-07-19T16:00:00-03:00", 12, ["K-sf-01", "K-sf-02"]);

fixtures.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

console.log(`Generated ${fixtures.length} fixtures`);
writeFileSync(
  new URL("../data/fixtures.json", import.meta.url),
  JSON.stringify(fixtures, null, 2)
);
console.log("→ data/fixtures.json");
