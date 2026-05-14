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
      // Bloqueamos pronósticos en partidos con equipos placeholder
      return !!(m.home?.iso && m.away?.iso);
    },

    formatKickoff(d) {
      if (!d) return "";
      const date = d instanceof Date ? d : new Date(d);
      return fmt.format(date);
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
      if (!f || f.status !== "finished" || f.homeScore == null) return null;
      if (f.homeScore > f.awayScore) return f.home;
      if (f.awayScore > f.homeScore) return f.away;
      return null; // empate sin definir (no debería pasar en final)
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
