import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig, AUTH_EMAIL_DOMAIN } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const FIRST_KICKOFF_ISO = "2026-06-11T20:00:00-05:00"; // Estadio Azteca, hora local CDMX

function normalizeNick(raw) {
  return (raw || "").toString().trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function nickToEmail(nick) {
  return `${nick}@${AUTH_EMAIL_DOMAIN}`;
}

function friendlyError(code) {
  const map = {
    "auth/invalid-credential": "Nick o PIN incorrectos.",
    "auth/wrong-password": "PIN incorrecto.",
    "auth/user-not-found": "Ese nick no está registrado.",
    "auth/email-already-in-use": "Ese nick ya está en uso. Probá entrar.",
    "auth/weak-password": "El PIN tiene que tener al menos 4 caracteres.",
    "auth/too-many-requests": "Demasiados intentos. Esperá un momento.",
    "auth/network-request-failed": "Sin conexión. Probá de nuevo."
  };
  return map[code] || "Error inesperado. Probá de nuevo.";
}

window.loginPage = function () {
  return {
    mode: "login",
    nick: "",
    pin: "",
    busy: false,
    error: "",
    countdown: "",
    _timer: null,

    init() {
      onAuthStateChanged(auth, (user) => {
        if (user) window.location.replace("./app.html");
      });
      this.updateCountdown();
      this._timer = setInterval(() => this.updateCountdown(), 1000);
    },

    updateCountdown() {
      const target = new Date(FIRST_KICKOFF_ISO).getTime();
      const diff = target - Date.now();
      if (diff <= 0) { this.countdown = ""; return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.countdown = `${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
    },

    async submit() {
      this.error = "";
      const nick = normalizeNick(this.nick);
      if (!nick || nick.length < 2) { this.error = "El nick necesita al menos 2 caracteres válidos."; return; }
      if (!this.pin || this.pin.length < 4) { this.error = "El PIN tiene que tener al menos 4 caracteres."; return; }

      this.busy = true;
      try {
        if (this.mode === "login") {
          await signInWithEmailAndPassword(auth, nickToEmail(nick), this.pin);
        } else {
          const taken = await getDoc(doc(db, "nicknames", nick));
          if (taken.exists()) throw { code: "auth/email-already-in-use" };
          const cred = await createUserWithEmailAndPassword(auth, nickToEmail(nick), this.pin);
          await setDoc(doc(db, "users", cred.user.uid), {
            nickname: nick,
            isAdmin: false,
            createdAt: serverTimestamp()
          });
          await setDoc(doc(db, "nicknames", nick), { uid: cred.user.uid });
        }
        window.location.replace("./app.html");
      } catch (e) {
        console.error(e);
        this.error = friendlyError(e.code);
      } finally {
        this.busy = false;
      }
    }
  };
};

// Helpers para el resto de la app
export { app, auth, db, signOut, normalizeNick, nickToEmail };
