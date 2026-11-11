import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions, pickRelease, createUpdater } from "../src/index.js";
import { banniere, carteEtat, sectionReglages, feuille } from "../src/ui.js";

test("comparaison des versions", () => {
  assert.ok(compareVersions("1.0.67", "1.0.66") > 0);
  assert.ok(compareVersions("1.0.9", "1.0.10") < 0);
  assert.equal(compareVersions("0.1.5", "0.1.5"), 0);
});

const releases = [
  { tag_name: "formup-v0.1.130", assets: [{ name: "FormUp.apk", size: 1, url: "api", browser_download_url: "web" }] },
  { tag_name: "plouf-v0.1.12", draft: true, assets: [{ name: "Plouf.apk" }] },
  { tag_name: "plouf-v0.1.11", body: "notes", assets: [{ name: "notes.txt" }, { name: "Plouf-0.1.11.apk", size: 5242880, url: "api", browser_download_url: "web" }] }
];

test("choix de la release : bon préfixe, pas de brouillon, APK présent", () => {
  const r = pickRelease(releases, "plouf-v", "");
  assert.equal(r.version, "0.1.11");
  assert.equal(r.url, "web");
  assert.equal(pickRelease(releases, "plouf-v", "jeton").url, "api");
  assert.equal(pickRelease(releases, "levelup-v", ""), null);
});

test("dans un navigateur : pas de mise à jour possible, interface vide", async () => {
  const u = createUpdater({ name: "Plouf", repo: "orfeo971/plouf", prefix: "plouf-v", private: true }, { capacitor: null, storage: null });
  assert.equal(u.state.canSelfUpdate, false);
  assert.equal(await u.check({ manual: true }), "Mise à jour possible seulement dans l'application Android");
  assert.equal(carteEtat(u), "");
  assert.equal(banniere(u), "");
  assert.match(sectionReglages(u), /jeton « fine-grained » limité au dépôt <b>plouf<\/b>/);
});

test("feuille : progression et étape de confirmation", () => {
  const u = createUpdater({ name: "Plouf", repo: "orfeo971/plouf", prefix: "plouf-v" }, { capacitor: null, storage: null });
  Object.assign(u.state, { latest: { version: "0.1.11", size: 5242880 }, status: "confirm", dl: 100, inst: 50 });
  const html = feuille(u);
  assert.match(html, /Confirme l'installation dans la fenêtre d'Android/);
  assert.match(banniere(u), /Nouvelle version 0\.1\.11/);
});

test("version installée lue dès le démarrage", async () => {
  const faux = { Capacitor: { isNativePlatform: () => true }, registerPlugin: n => n === "App" ? { getInfo: async () => ({ version: "0.1.8" }) } : { addListener() {} } };
  const u = createUpdater({ name: "Plouf", repo: "orfeo971/plouf", prefix: "plouf-v" }, { capacitor: faux, storage: null });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(u.state.current, "0.1.8");
});

test("la version la plus haute l'emporte, quel que soit l'ordre de GitHub", () => {
  const apk = n => [{ name: n + ".apk", size: 1, url: "api", browser_download_url: "web" }];
  const l = [{ tag_name: "plouf-v0.1.9", assets: apk("9") }, { tag_name: "plouf-v0.1.10", assets: apk("10") }, { tag_name: "plouf-v0.1.8", assets: apk("8") }];
  assert.equal(pickRelease(l, "plouf-v", "").version, "0.1.10");
});
