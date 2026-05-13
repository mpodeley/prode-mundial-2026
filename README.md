# Prode Pluspetrol — Mundial 2026

Sitio web tipo "prode" para los compañeros de Pluspetrol. Corre en GitHub Pages (estático, gratis) y usa Firebase para login y almacenamiento. Pensado para 50 personas, los 104 partidos del Mundial 2026, sin build step y con mantenimiento mínimo.

## Cómo funciona

- **Hosting**: GitHub Pages, branch `main` desde la raíz.
- **UI**: HTML + Tailwind (CDN) + Alpine.js (CDN). Editás un archivo, hacés push, listo.
- **Auth**: Firebase Auth con email/password — usamos nick + PIN, traduciendo a `${nick}@prode.local` por debajo. Sin emails reales.
- **Base de datos**: Firestore. Las reglas en `firestore.rules` cierran los pronósticos automáticamente al iniciar cada partido.
- **Scoring** (clásico): 3 puntos por marcador exacto, 1 punto por acertar ganador/empate, 0 si errás. El cálculo vive en `assets/scoring.js`.
- **Resultados híbridos**: un GitHub Action consulta api-football cada hora durante el torneo. El panel `admin.html` permite overridear cualquier resultado a mano (los overrides no son pisados por la API).

## Estructura

```
.
├── index.html              Login / registro
├── app.html                SPA principal (fixtures, pronósticos, ranking)
├── admin.html              Panel admin (override de resultados)
├── assets/
│   ├── firebase-config.js  ← editar con tu config de Firebase
│   ├── auth.js
│   ├── app.js
│   ├── scoring.js
│   └── style.css
├── data/fixtures.json      104 partidos (placeholders hasta cargar equipos reales)
├── scripts/
│   ├── generate-fixtures.mjs  regenera el JSON si querés cambiar fechas
│   ├── seed-fixtures.mjs      lo sube a Firestore (una sola vez)
│   └── fetch-results.mjs      lo corre la GitHub Action
├── .github/workflows/update-results.yml
└── firestore.rules
```

## Setup paso a paso (~30 min, una sola vez)

### 1. Firebase

1. Crear proyecto en [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Get Started → activar el provider **Email/Password**.
3. **Firestore Database** → Create database → modo producción → región más cercana (ej. `southamerica-east1`).
4. **Project settings → General → Your apps → Web app** (`</>`): copiar el objeto `firebaseConfig` y pegarlo en `assets/firebase-config.js`.
5. **Firestore → Rules** → pegar el contenido de `firestore.rules` → Publish.

### 2. Service account (para los scripts de Node)

1. **Project settings → Service accounts → Generate new private key** → guardar el JSON como `service-account.json` en la raíz del repo (ya está en `.gitignore`, no se commitea).

### 3. Cargar los fixtures iniciales

```powershell
npm install firebase-admin
node scripts/seed-fixtures.mjs
```

Esto inserta los 104 partidos en `matches/` con equipos placeholder (`Equipo A1`, etc.). Después del sorteo oficial del Mundial editás `data/fixtures.json` con los equipos reales y volvés a correr el seed (no pisa overrides manuales).

### 4. GitHub Pages

1. Crear repo en GitHub → push.
2. **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `/` (root)** → Save.
3. Esperar ~1 min, la URL queda como `https://<tu-usuario>.github.io/<nombre-repo>/`.

### 5. GitHub Action (resultados automáticos) — opcional

1. Conseguir API key de [api-football en RapidAPI](https://rapidapi.com/api-sports/api/api-football) (free tier 100 req/día alcanza).
2. **Repo → Settings → Secrets and variables → Actions → New repository secret**:
   - `FIREBASE_SERVICE_ACCOUNT` → pegar el JSON completo del service account.
   - `RAPIDAPI_KEY` → la API key.
3. La action corre sola cada hora durante junio/julio 2026. También podés gatillarla manualmente desde la pestaña **Actions**.

### 6. Promover tu cuenta a admin

1. Registrate en la web con tu nick/PIN.
2. **Firebase Console → Firestore → users → tu UID** → editar campo `isAdmin: true`.
3. Recargá la página: ahora ves el link "Admin" arriba a la derecha.

## Operación durante el torneo

- **Cargar resultados a mano**: `admin.html` → buscar partido → poner goles → estado **Final** → Guardar. La columna `[manual]` marca los partidos que la API ya no va a pisar.
- **Forzar sync de la API**: GitHub Actions → workflow "Update Mundial 2026 results" → Run workflow.
- **Si la API falla o no devuelve un partido**: cargalo a mano. No hay drama.

## Reglas del prode

- 3 puntos: marcador exacto.
- 1 punto: acertar ganador o empate.
- 0 puntos: errar.
- Los pronósticos se cierran **automáticamente** al kickoff de cada partido (regla de Firestore, no truco de UI).
- Se contabilizan solo los partidos en estado `finished`.

## Cambiar las reglas de puntaje

Editar el doc `config/scoring` en Firestore (desde la consola o `admin.html` en el futuro). La UI lo levanta al cargar.

## Verificación local

```powershell
python -m http.server 8000
# abrir http://localhost:8000
```

Crear 2-3 usuarios de prueba, marcar uno como admin desde la consola, cargar un par de resultados, validar el ranking.

## Decisiones de diseño

- **Sin build step** a propósito: cero infraestructura, mantenimiento trivial, deploy = `git push`.
- **API keys de Firebase en el código**: son públicas por diseño; la seguridad real son las reglas de Firestore.
- **Ranking calculado en el cliente**: ~5000 docs es trivial, evita una Cloud Function.
- **Cierre de apuestas en regla Firestore**: imposible hacer trampa cambiando la hora del cliente.
