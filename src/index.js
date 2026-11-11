/* @orfeo/updater : mise à jour d'une application Android depuis l'application elle-même.
   Les versions sont lues dans les Releases GitHub du dépôt de l'application (étiquette <prefix><version>, APK joint),
   l'APK est téléchargé puis installé par Android (extension native « AppUpdater », dossier android/).
   Code repris de Level Up, sans changement de comportement. Toutes les applications d'orfeo971 l'utilisent. */

/* compare « 1.0.66 » et « 1.0.67 » : > 0 si a est plus récente */
export function compareVersions(a, b) {
  const x = String(a || "0").split(".").map(Number), y = String(b || "0").split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}

/* release la plus récente (numéro de version le plus haut, pas la première de la liste : GitHub classe
   « 0.1.9 » avant « 0.1.10 ») dont l'étiquette commence par prefix et qui contient un APK */
export function pickRelease(list, prefix, token) {
  const candidates = (list || []).filter(x => !x.draft && String(x.tag_name || "").startsWith(prefix) && (x.assets || []).some(a => /\.apk$/i.test(a.name)));
  if (!candidates.length) return null;
  const rel = candidates.reduce((best, x) => (compareVersions(x.tag_name.slice(prefix.length), best.tag_name.slice(prefix.length)) > 0 ? x : best));
  const asset = rel.assets.find(a => /\.apk$/i.test(a.name));
  return { version: rel.tag_name.slice(prefix.length), tag: rel.tag_name, name: rel.name, notes: rel.body || "", page: rel.html_url, size: asset.size,
    /* dépôt privé : lien d'API (le jeton ne part que vers api.github.com) ; public : lien direct */
    url: token ? asset.url : asset.browser_download_url };
}

function messageHttp(status, token) {
  if (status === 401 || status === 403) return token ? "jeton GitHub refusé" : "dépôt privé : jeton GitHub nécessaire";
  if (status === 404) return token ? "dépôt introuvable avec ce jeton" : "dépôt de diffusion introuvable (pas encore public ?)";
  return "GitHub indisponible (" + status + ")";
}

/**
 * @param {{name: string, repo: string, prefix: string, private?: boolean, storage?: string}} config
 *   name : nom affiché ; repo : « propriétaire/dépôt » ; prefix : début des étiquettes (« plouf-v ») ;
 *   private : dépôt privé (jeton GitHub de lecture saisi sur le téléphone) ; storage : préfixe des clés localStorage.
 * @param {{capacitor?: object, storage?: Storage}} [env] injection (tests, ou autre façon de charger Capacitor)
 */
export function createUpdater(config, env = {}) {
  const cfg = { private: false, storage: config.prefix.replace(/-v$/, ""), ...config };
  const cap = env.capacitor !== undefined ? env.capacitor : (typeof window !== "undefined" ? window.capacitorExports : null);
  const isNative = !!(cap && cap.Capacitor && cap.Capacitor.isNativePlatform && cap.Capacitor.isNativePlatform());
  const Updater = isNative ? cap.registerPlugin("AppUpdater") : null;
  const App = isNative ? cap.registerPlugin("App") : null;
  const store = env.storage !== undefined ? env.storage : (typeof localStorage !== "undefined" ? localStorage : null);
  const TOKEN_KEY = cfg.storage + "-github-token", CHECK_KEY = cfg.storage + "-update-check";
  const get = k => { try { return (store && store.getItem(k)) || ""; } catch (e) { return ""; } };
  const set = (k, v) => { try { if (!store) return; v ? store.setItem(k, v) : store.removeItem(k); } catch (e) { /* ignoré */ } };

  /* état lu par l'interface (voir ui.js) */
  const state = { name: cfg.name, private: cfg.private, canSelfUpdate: !!Updater, current: null, latest: null,
    checking: false, checkedAt: get(CHECK_KEY) || null, error: null, status: "idle", dl: 0, inst: 0, msg: "" };
  const listeners = new Set();
  const changed = () => listeners.forEach(fn => { try { fn(state); } catch (e) { /* ignoré */ } });

  const token = () => get(TOKEN_KEY);
  const needToken = () => cfg.private && !token();

  async function appVersion() { try { return App ? (await App.getInfo()).version : null; } catch (e) { return null; } }

  async function latestRelease() {
    const url = "https://api.github.com/repos/" + cfg.repo + "/releases?per_page=100";
    const t = cfg.private ? token() : "";
    const headers = { Accept: "application/vnd.github+json", "User-Agent": "orfeo-updater", ...(t ? { Authorization: "Bearer " + t } : {}) };
    let list;
    const Http = isNative && cap.CapacitorHttp;
    if (Http) {
      const r = await Http.request({ method: "GET", url, headers });
      if (r.status >= 400) throw new Error(messageHttp(r.status, t));
      list = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
    } else {
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(messageHttp(r.status, t));
      list = await r.json();
    }
    return pickRelease(list, cfg.prefix, t);
  }

  /** Recherche une nouvelle version. Renvoie un message à afficher (recherche manuelle) ou null. */
  async function check({ manual = false } = {}) {
    if (!Updater) return manual ? "Mise à jour possible seulement dans l'application Android" : null;
    if (needToken()) return manual ? "Ajoute d'abord ton jeton GitHub (lecture)" : null;
    state.checking = true; state.error = null; changed();
    let msg = null;
    try {
      state.current = await appVersion();
      const rel = await latestRelease();
      state.latest = rel && compareVersions(rel.version, state.current) > 0 ? rel : null;
      state.checkedAt = new Date().toISOString(); set(CHECK_KEY, state.checkedAt);
      msg = state.latest ? "Version " + state.latest.version + " disponible" : "Tu as la dernière version (" + state.current + ")";
    } catch (e) { state.error = e.message || String(e); msg = "Recherche impossible : " + state.error; }
    state.checking = false; changed();
    return manual ? msg : null;
  }

  /** Vérification automatique : au plus une fois toutes les `heures` heures. */
  function autoCheck(heures = 20) {
    if (!Updater || state.checking || needToken()) return;
    if (!state.checkedAt || Date.now() - Date.parse(state.checkedAt) > heures * 3600000) check();
  }

  /** Télécharge puis installe la version trouvée (demande d'abord l'autorisation d'installer si besoin). */
  async function start() {
    const l = state.latest; if (!l || !Updater) return;
    state.msg = "";
    let allowed = false;
    try { allowed = (await Updater.canInstall()).allowed; } catch (e) { allowed = false; }
    if (!allowed) { state.status = "permission"; changed(); return; }
    state.status = "download"; state.dl = 0; state.inst = 0; changed();
    try {
      await Updater.download({ url: l.url, token: cfg.private ? token() : "" });
      state.dl = 100; state.status = "install"; changed();
      await Updater.install();
    } catch (e) { state.status = "error"; state.msg = e.message || String(e); changed(); }
  }

  /* version installée connue dès le démarrage (sinon « ? » jusqu'à la prochaine recherche) */
  if (Updater) appVersion().then(v => { if (v && !state.current) { state.current = v; changed(); } });

  if (Updater) {
    try {
      Updater.addListener("updateProgress", e => {
        if (e.phase === "download") state.dl = e.pct >= 0 ? e.pct : state.dl;
        else {
          state.inst = e.pct;
          if (e.status === "confirm") state.status = "confirm";
          else if (e.status === "success") state.status = "success";
          else if (e.status === "failure") { state.status = "error"; state.msg = e.message || "installation annulée"; }
          else if (state.status !== "confirm") state.status = "install";
        }
        changed();
      });
    } catch (e) { /* ignoré */ }
  }

  return {
    state, check, autoCheck, start,
    cancel: () => { if (Updater) Updater.cancel(); state.status = "idle"; changed(); },
    openInstallSettings: () => Updater && Updater.openInstallSettings(),
    onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    token, setToken: v => { set(TOKEN_KEY, (v || "").trim()); changed(); },
    get needToken() { return needToken(); },
    config: cfg
  };
}
