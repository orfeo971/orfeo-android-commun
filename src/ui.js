/* Interface en français des mises à jour, en HTML à insérer dans l'application (repris de Level Up à l'identique).
   Styles : src/ui.css (mêmes classes que Level Up). La page qui affiche ces blocs branche les actions (data-act) :
   update-open (ouvrir la feuille), update-check, update-start, update-cancel, update-perm (autorisation Android),
   update-token (aller à la saisie du jeton), gh-token-save (enregistrer #ghTokenIn), gh-token-del (retirer le jeton). */

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const mo = n => (n / 1048576).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " Mo";
const quand = iso => { try { return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };

/** Bannière d'accueil quand une version est disponible. */
export function banniere(u) {
  const l = u.state.latest;
  return l ? '<div class="banner update"><span><b>Nouvelle version ' + esc(l.version) + '</b> disponible.</span><button class="btn small primary" data-act="update-open">Mettre à jour</button></div>' : "";
}

/** Carte d'état en haut des Réglages : à jour, mise à jour disponible, recherche, jeton manquant ou problème. */
export function carteEtat(u) {
  const st = u.state;
  if (!st.canSelfUpdate) return "";
  const ver = st.current || "?", when = st.checkedAt ? "vérifiée le " + quand(st.checkedAt) : "";
  let cls, icon, title, sub, btn;
  if (st.checking) { cls = "checking"; icon = "⟳"; title = "Recherche d'une mise à jour…"; sub = st.name + " " + ver; btn = ""; }
  else if (st.latest) { cls = "available"; icon = "⬆"; title = "Mise à jour disponible : version " + st.latest.version; sub = "Installée : " + ver + (st.latest.size ? " · " + mo(st.latest.size) + " à télécharger" : ""); btn = '<button class="btn primary" data-act="update-open">Mettre à jour</button>'; }
  else if (u.needToken) { cls = "warn"; icon = "🔑"; title = "Jeton GitHub à ajouter"; sub = "Pour chercher les mises à jour de " + st.name + " (dépôt privé) : Réglages › Mises à jour"; btn = '<button class="btn" data-act="update-token">Ajouter</button>'; }
  else if (st.error) { cls = "warn"; icon = "!"; title = "Vérification impossible"; sub = st.error; btn = '<button class="btn" data-act="update-check">Réessayer</button>'; }
  else if (st.checkedAt) { cls = "ok"; icon = "✓"; title = st.name + " est à jour"; sub = "Version " + ver + " · " + when; btn = '<button class="btn" data-act="update-check">Vérifier</button>'; }
  else { cls = ""; icon = "ⓘ"; title = st.name + " " + ver; sub = "Recherche les nouvelles versions publiées"; btn = '<button class="btn primary" data-act="update-check">Vérifier les mises à jour</button>'; }
  return '<section class="card upd-card ' + cls + '"><span class="upd-ic" aria-hidden="true">' + icon + '</span><div class="upd-tx"><b>' + esc(title) + "</b><small>" + esc(sub) + "</small></div>" + btn + "</section>";
}

/** Section « Mises à jour » des Réglages, avec la saisie du jeton pour un dépôt privé. */
export function sectionReglages(u) {
  const st = u.state, cfg = u.config, l = st.latest;
  return "<h2>Mises à jour</h2><div class=\"card\">"
    + "<p style=\"margin-top:0\">Version installée : <b>" + esc(st.current || "?") + "</b>" + (st.checkedAt ? ' <small class="note">· ' + esc("vérifiée le " + quand(st.checkedAt)) + "</small>" : "") + "</p>"
    + (cfg.private ? (u.token() ? '<p class="note">Jeton GitHub enregistré sur ce téléphone. <button class="linkbtn" data-act="gh-token-del">Retirer</button></p>'
        : '<label class="field">Jeton GitHub (lecture seule)<input type="password" id="ghTokenIn" autocomplete="off" placeholder="github_pat_…"></label><div class="actions"><button class="btn" data-act="gh-token-save">Enregistrer le jeton</button></div>'
        + '<p class="note">Le dépôt de ' + esc(st.name) + " est privé : crée sur github.com un jeton « fine-grained » limité au dépôt <b>" + esc(cfg.repo.split("/")[1]) + "</b>, permission <b>Contents : Read-only</b>. Il reste sur ce téléphone, hors sauvegardes.</p>") : "")
    + (l ? '<div class="priority lv-vert"><b>Version ' + esc(l.version) + " disponible</b>" + (l.size ? " (" + mo(l.size) + ")" : "") + "</div>" : st.error ? '<p class="note">Dernière recherche : ' + esc(st.error) + "</p>" : "")
    + '<div class="actions">' + (l ? '<button class="btn primary" data-act="update-open">Mettre à jour</button>' : "") + '<button class="btn" data-act="update-check"' + (st.checking ? " disabled" : "") + ">" + (st.checking ? "Recherche…" : "Rechercher une mise à jour") + "</button></div>"
    + '<p class="note">La nouvelle version se télécharge et s\'installe depuis l\'application. Android demande une confirmation, puis remplace l\'application : tes données sont conservées.</p></div>';
}

/** Titre et contenu de la feuille de mise à jour : autorisation, progression, résultat, notes de version. */
export const titreFeuille = u => "Mise à jour " + (u.state.latest ? u.state.latest.version : "");
export function feuille(u) {
  const st = u.state, l = st.latest || {}, s = st.status;
  const bar = (label, pct, sub) => '<div class="upd-step"><div class="upd-l"><span>' + label + "</span><b>" + (pct >= 0 ? Math.round(pct) + " %" : "…") + '</b></div><span class="upd-bar"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></span>' + (sub ? "<small>" + sub + "</small>" : "") + "</div>";
  return '<p style="margin-top:0">' + esc(st.name) + " " + esc(st.current || "") + " → <b>" + esc(l.version || "") + "</b>" + (l.size ? " · " + mo(l.size) : "") + "</p>"
    + (s === "permission" ? '<div class="priority lv-orange"><b>Une autorisation à donner, une seule fois</b>Android doit autoriser ' + esc(st.name) + " à installer ses mises à jour. Touche « Autoriser », active « Autoriser depuis cette source », puis reviens ici.</div>"
      + '<div class="actions"><button class="btn primary" data-act="update-perm">Autoriser</button><button class="btn" data-act="update-start">J\'ai autorisé, continuer</button></div>' : "")
    + bar("Téléchargement", st.dl, s === "download" && l.size ? mo(l.size * st.dl / 100) + " sur " + mo(l.size) : st.dl >= 100 ? "terminé" : "")
    + bar("Installation", st.inst, s === "confirm" ? "Confirme l'installation dans la fenêtre d'Android" : s === "install" ? "installation en cours…" : s === "success" ? "terminée" : "")
    + (s === "success" ? '<div class="priority lv-vert"><b>Mise à jour installée</b>Android ferme l\'application pour la remplacer : rouvre-la si elle ne se relance pas seule.</div>' : "")
    + (s === "error" ? '<div class="priority lv-rouge"><b>Mise à jour interrompue</b>' + esc(st.msg) + "</div>" : "")
    + '<div class="actions">' + (s === "idle" || s === "error" ? '<button class="btn primary" data-act="update-start">' + (s === "error" ? "Réessayer" : "Télécharger et installer") + "</button>" : "")
    + (s === "download" ? '<button class="btn" data-act="update-cancel">Annuler</button>' : "") + "</div>"
    + (l.notes && s === "idle" ? '<p class="note">' + esc(l.notes.split("\n").slice(0, 3).join(" ")) + "</p>" : "");
}
