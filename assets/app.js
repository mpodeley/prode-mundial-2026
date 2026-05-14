import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs, onSnapshot, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { score, isExact, isWinnerOnly, DEFAULT_RULES } from "./scoring.js";

const CONFIG_OK = firebaseConfig.apiKey && firebaseConfig.apiKey !== "REEMPLAZAR";
if (!CONFIG_OK) {
  window.location.replace("./index.html");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STAGE_LABEL = {
  group: "Fase de grupos",
  r32: "32avos de final",
  r16: "Octavos de final",
  qf: "Cuartos de final",
  sf: "Semifinales",
  third: "Tercer puesto",
  final: "Final"
};
const STAGE_ORDER = ["group", "r32", "r16", "qf", "sf", "third", "final"];

const fmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires"
});

const fmtShort = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires"
});

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function prodeAppData() {
  return {
    loading: true,
    tab: "fixtures",
    stageFilter: "",
    onlyMine: false,
    user: null,
    matches: [],
    myPredictions: {},
    allPredictions: [],
    usersById: {},
    saveStatus: {},
    rules: { ...DEFAULT_RULES },
    _unsubMatches: null,

    get tabs() {
      return [
        { id: "fixtures", label: "Fixtures" },
        { id: "groups",   label: "Grupos" },
        { id: "bracket",  label: "Llaves" },
        { id: "mine",     label: "Mis pronósticos", badge: this.pendingMatches.length || null },
        { id: "ranking",  label: "Ranking" }
      ];
    },

    async init() {
      onAuthStateChanged(auth, async (u) => {
        if (!u) { window.location.replace("./index.html"); return; }
        const snap = await getDoc(doc(db, "users", u.uid));
        this.user = { uid: u.uid, ...snap.data() };
        await Promise.all([this.loadRules(), this.loadMyPredictions()]);
        this.subscribeMatches();
      });
    },

    async loadRules() {
      try {
        const s = await getDoc(doc(db, "config", "scoring"));
        if (s.exists()) this.rules = { ...DEFAULT_RULES, ...s.data() };
      } catch (e) { console.warn("No se pudo cargar scoring config", e); }
    },

    subscribeMatches() {
      this._unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
        this.matches = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            kickoff: data.kickoff?.toDate ? data.kickoff.toDate() : new Date(data.kickoff)
          };
        }).sort((a, b) => a.kickoff - b.kickoff);
        this.loading = false;
      });
    },

    async loadMyPredictions() {
      const q = query(collection(db, "predictions"), where("uid", "==", this.user.uid));
      const snap = await getDocs(q);
      const acc = {};
      snap.forEach(d => {
        const p = d.data();
        acc[p.matchId] = { ...p };
      });
      this.myPredictions = acc;
    },

    async loadRanking() {
      const [predSnap, userSnap] = await Promise.all([
        getDocs(collection(db, "predictions")),
        getDocs(collection(db, "users"))
      ]);
      this.allPredictions = predSnap.docs.map(d => d.data());
      this.usersById = {};
      userSnap.forEach(d => { this.usersById[d.id] = d.data(); });
    },

    // --- Helpers de UI ---
    flagHtml(team, size = "default") {
      if (!team || !team.iso) {
        return `<span class="inline-block text-xs bg-white/10 text-white/60 rounded px-1">?</span>`;
      }
      const dim = size === "big" ? "h-12 w-16" : size === "small" ? "h-4 w-6" : "h-5 sm:h-6 w-8 sm:w-9";
      const safe = escapeHtml(team.iso);
      const alt = escapeHtml(team.code || "");
      return `<img src="https://flagcdn.com/w80/${safe}.png" alt="${alt}" class="${dim} object-cover rounded shadow inline-block" loading="lazy" />`;
    },

    isOpen(m) {
      return m.status !== "finished" && m.kickoff && new Date(m.kickoff).getTime() > Date.now();
    },

    canPredict(m) {
      // Bloqueamos pronósticos hasta que los equipos efectivos estén resueltos
      // (directamente asignados, o derivados de mi pronóstico de la ronda anterior).
      return !!(this.effectiveTeam(m, 'home').iso && this.effectiveTeam(m, 'away').iso);
    },

    formatKickoff(d) {
      if (!d) return "";
      const date = d instanceof Date ? d : new Date(d);
      return fmt.format(date);
    },

    formatKickoffShort(d) {
      if (!d) return "";
      const date = d instanceof Date ? d : new Date(d);
      return fmtShort.format(date);
    },

    pointsFor(m) {
      return score(this.myPredictions[m.id], m, this.rules);
    },

    formatMyPrediction(m) {
      const p = this.myPredictions[m.id];
      if (!p) return "";
      if (p.type === "winner") {
        const label = { home: "Gana local", draw: "Empate", away: "Gana visitante" }[p.winner];
        return `Solo ganador: ${label}`;
      }
      return `Tu pronóstico: ${p.home}-${p.away}`;
    },

    isWinnerPick(m, side) {
      const p = this.myPredictions[m.id];
      return p && p.type === "winner" && p.winner === side;
    },

    getScoreField(m, field) {
      const p = this.myPredictions[m.id];
      if (!p || p.type === "winner") return "";
      return p[field] ?? "";
    },

    // --- Edición de pronósticos ---
    async onScoreInput(m, field, value) {
      if (!this.isOpen(m) || !this.canPredict(m)) return;
      const num = value === "" ? null : Number(value);
      // Si el pronóstico actual era "winner", al tocar marcador limpiamos esa modalidad
      const current = (this.myPredictions[m.id] && this.myPredictions[m.id].type !== "winner")
        ? this.myPredictions[m.id]
        : { home: null, away: null };
      const updated = { ...current, [field]: num, type: "score" };
      this.myPredictions[m.id] = updated;

      if (!Number.isInteger(updated.home) || !Number.isInteger(updated.away)) return;
      if (updated.home < 0 || updated.away < 0 || updated.home > 20 || updated.away > 20) {
        this.saveStatus[m.id] = { ok: false, msg: "Valores entre 0 y 20." }; return;
      }
      await this._save(m, {
        type: "score",
        home: updated.home,
        away: updated.away
      });
    },

    async pickWinner(m, winner) {
      if (!this.isOpen(m) || !this.canPredict(m)) return;
      if (!["home","draw","away"].includes(winner)) return;
      this.myPredictions[m.id] = { type: "winner", winner };
      await this._save(m, { type: "winner", winner });
    },

    async _save(m, payload) {
      try {
        await setDoc(doc(db, "predictions", `${this.user.uid}_${m.id}`), {
          uid: this.user.uid,
          matchId: m.id,
          submittedAt: serverTimestamp(),
          ...payload
        });
        this.saveStatus[m.id] = { ok: true, msg: "Guardado ✓" };
        setTimeout(() => { delete this.saveStatus[m.id]; }, 1500);
      } catch (e) {
        console.error(e);
        this.saveStatus[m.id] = { ok: false, msg: "No se pudo guardar (¿partido cerrado o reglas viejas?)" };
      }
    },

    // --- Computed: agrupado / pendientes / stats / ranking ---
    get groupedFixtures() {
      let list = this.matches;
      if (this.stageFilter) list = list.filter(m => m.stage === this.stageFilter);
      if (this.onlyMine) list = list.filter(m => !this.myPredictions[m.id] && this.isOpen(m));
      const groups = {};
      for (const m of list) {
        const key = m.stage === "group" ? `group-${m.group || "?"}` : m.stage;
        if (!groups[key]) groups[key] = { key, label: this.groupLabel(m), matches: [] };
        groups[key].matches.push(m);
      }
      return Object.values(groups).sort((a, b) => {
        const sa = STAGE_ORDER.indexOf(a.key.startsWith("group") ? "group" : a.key);
        const sb = STAGE_ORDER.indexOf(b.key.startsWith("group") ? "group" : b.key);
        if (sa !== sb) return sa - sb;
        return a.key.localeCompare(b.key);
      });
    },

    groupLabel(m) {
      if (m.stage === "group") return `Grupo ${m.group}`;
      return STAGE_LABEL[m.stage] || m.stage;
    },

    get pendingMatches() {
      return this.matches.filter(m => this.isOpen(m) && this.canPredict(m) && !this.myPredictions[m.id]);
    },

    get myStats() {
      let total = 0, exact = 0, winners = 0, predicted = 0;
      for (const m of this.matches) {
        const p = this.myPredictions[m.id];
        if (p) predicted++;
        if (m.status !== "finished") continue;
        const pts = score(p, m, this.rules);
        total += pts;
        if (isExact(p, m)) exact++;
        else if (isWinnerOnly(p, m)) winners++;
      }
      return { total, exact, winners, predicted };
    },

    get ranking() {
      if (!this.allPredictions.length && this.tab === "ranking") this.loadRanking();
      const matchById = Object.fromEntries(this.matches.map(m => [m.id, m]));
      const stats = {};
      for (const [uid, u] of Object.entries(this.usersById)) {
        stats[uid] = { uid, nickname: u.nickname, total: 0, exact: 0, winners: 0, played: 0 };
      }
      for (const p of this.allPredictions) {
        const m = matchById[p.matchId];
        if (!m || m.status !== "finished") continue;
        const row = stats[p.uid] || (stats[p.uid] = { uid: p.uid, nickname: "(?)", total: 0, exact: 0, winners: 0, played: 0 });
        row.played++;
        if (isExact(p, m)) { row.exact++; row.total += this.rules.exact; }
        else if (isWinnerOnly(p, m)) { row.winners++; row.total += this.rules.winner; }
      }
      return Object.values(stats).sort((a, b) =>
        b.total - a.total || b.exact - a.exact || a.nickname.localeCompare(b.nickname)
      );
    },

    // Partidos de un grupo, ordenados por fecha
    matchesOfGroup(letter) {
      return this.matches
        .filter(m => m.stage === "group" && m.group === letter)
        .sort((a, b) => a.kickoff - b.kickoff);
    },

    // --- Standings de grupos (predicho + tiempo real combinado) ---
    get groupStandings() {
      const groups = {};
      const groupMatches = this.matches.filter(m => m.stage === "group");

      for (const m of groupMatches) {
        const g = m.group;
        if (!groups[g]) groups[g] = {};
        for (const t of [m.home, m.away]) {
          if (!t?.code) continue;
          if (!groups[g][t.code]) {
            groups[g][t.code] = {
              team: t, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0,
              hasPredicted: false, hasReal: false
            };
          }
        }

        let hs, as, source = null;
        if (m.status === "finished" && m.homeScore != null && m.awayScore != null) {
          hs = m.homeScore; as = m.awayScore; source = "real";
        } else {
          const p = this.myPredictions[m.id];
          // Solo predicciones de marcador (score). Las de solo-ganador no aportan a goles.
          if (p && p.type !== "winner" && Number.isInteger(p.home) && Number.isInteger(p.away)) {
            hs = p.home; as = p.away; source = "pred";
          }
        }
        if (hs == null) continue;

        const H = groups[g][m.home.code];
        const A = groups[g][m.away.code];
        H.played++; A.played++;
        H.gf += hs; H.ga += as;
        A.gf += as; A.ga += hs;
        if (hs > as)      { H.w++; A.l++; H.pts += 3; }
        else if (hs < as) { A.w++; H.l++; A.pts += 3; }
        else              { H.d++; A.d++; H.pts++; A.pts++; }
        if (source === "real") { H.hasReal = true; A.hasReal = true; }
        if (source === "pred") { H.hasPredicted = true; A.hasPredicted = true; }
      }

      const cmp = (a, b) =>
        b.pts - a.pts ||
        (b.gf - b.ga) - (a.gf - a.ga) ||
        b.gf - a.gf ||
        a.team.name.localeCompare(b.team.name);

      const out = [];
      for (const g of Object.keys(groups).sort()) {
        out.push({
          letter: g,
          rows: Object.values(groups[g]).sort(cmp)
        });
      }
      return out;
    },

    // --- Bracket ---
    get bracketColumns() {
      const cols = ["r32", "r16", "qf", "sf", "final"];
      return cols.map(stage => ({
        stage,
        label: { r32: "32avos", r16: "Octavos", qf: "Cuartos", sf: "Semis", final: "Final" }[stage],
        matches: this.matches
          .filter(m => m.stage === stage)
          .sort((a, b) => (a.bracketIndex ?? 0) - (b.bracketIndex ?? 0))
      }));
    },

    get thirdMatch() {
      return this.matches.find(m => m.stage === "third") || null;
    },

    get champion() {
      const f = this.matches.find(m => m.stage === "final");
      if (!f) return null;
      // 1) Si la final terminó → campeón real
      if (f.status === "finished" && f.homeScore != null && f.awayScore != null) {
        if (f.homeScore > f.awayScore) return this.effectiveTeam(f, 'home');
        if (f.awayScore > f.homeScore) return this.effectiveTeam(f, 'away');
      }
      // 2) Sino, usar mi pronóstico de la final
      const side = this._winnerOf(f);
      if (!side) return null;
      return this.effectiveTeam(f, side);
    },

    // Devuelve 'home' | 'away' | null según el resultado real o mi pronóstico
    _winnerOf(match) {
      if (!match) return null;
      if (match.status === "finished" && match.homeScore != null && match.awayScore != null) {
        if (match.homeScore > match.awayScore) return 'home';
        if (match.awayScore > match.homeScore) return 'away';
        return null;
      }
      const pred = this.myPredictions[match.id];
      if (!pred) return null;
      if (pred.type === 'winner') return pred.winner !== 'draw' ? pred.winner : null;
      if (Number.isInteger(pred.home) && Number.isInteger(pred.away)) {
        if (pred.home > pred.away) return 'home';
        if (pred.away > pred.home) return 'away';
      }
      return null;
    },

    // Resuelve el equipo "efectivo" para un lado de un partido, propagando ganadores
    effectiveTeam(m, side) {
      if (!m) return { code: '?', iso: null, name: 'Por definir' };
      const direct = m[side];
      if (direct?.iso) return direct;
      if (!Array.isArray(m.sources) || m.sources.length < 2) {
        return { code: '?', iso: null, name: 'Por definir' };
      }
      const parentId = side === 'home' ? m.sources[0] : m.sources[1];
      const parent = this.matches.find(x => x.id === parentId);
      if (!parent) return { code: '?', iso: null, name: 'Por definir' };

      const winnerSide = this._winnerOf(parent);
      if (!winnerSide) return { code: '?', iso: null, name: 'Por definir' };

      // El 3er puesto recibe a los PERDEDORES de las semis
      const targetSide = m.stage === 'third'
        ? (winnerSide === 'home' ? 'away' : 'home')
        : winnerSide;

      return this.effectiveTeam(parent, targetSide);
    },

    // Pronóstico desde el bracket: solo ganador.
    // Si los equipos efectivos no están resueltos, no se puede picar.
    async pickInBracket(m, side) {
      if (!this.isOpen(m)) return;
      const team = this.effectiveTeam(m, side);
      if (!team.iso) {
        this.saveStatus[m.id] = { ok: false, msg: "Definí primero el partido anterior." };
        setTimeout(() => { delete this.saveStatus[m.id]; }, 1800);
        return;
      }
      this.myPredictions[m.id] = { type: 'winner', winner: side };
      await this._save(m, { type: 'winner', winner: side });
    },

    // Indicador visual de qué lado tengo elegido (ganador) en cada partido
    getBracketPick(m) {
      const p = this.myPredictions[m.id];
      if (!p) return null;
      if (p.type === 'winner') return p.winner !== 'draw' ? p.winner : null;
      if (Number.isInteger(p.home) && Number.isInteger(p.away)) {
        if (p.home > p.away) return 'home';
        if (p.away > p.home) return 'away';
      }
      return null;
    },

    goToMatch(id) {
      this.tab = "fixtures";
      // pequeño delay para que el DOM renderice
      setTimeout(() => {
        const el = document.getElementById("m-" + id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2","ring-amber-400");
          setTimeout(() => el.classList.remove("ring-2","ring-amber-400"), 1500);
        }
      }, 100);
    },

    async logout() {
      await signOut(auth);
      window.location.replace("./index.html");
    }
  };
}

window.prodeApp = prodeAppData;
if (window.Alpine) {
  window.Alpine.data("prodeApp", prodeAppData);
} else {
  document.addEventListener("alpine:init", () => {
    window.Alpine.data("prodeApp", prodeAppData);
  });
}
