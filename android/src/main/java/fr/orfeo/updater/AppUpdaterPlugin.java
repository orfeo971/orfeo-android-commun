package fr.orfeo.updater;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Mise à jour depuis l'application : téléchargement de l'APK (avec progression), puis installation
 * par l'installateur d'Android (PackageInstaller, avec progression). Android demande une confirmation
 * à l'utilisateur ; l'application est ensuite remplacée par la nouvelle version.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static AppUpdaterPlugin instance;
    private volatile boolean cancelled = false;

    @Override
    public void load() {
        instance = this;
    }

    static void emit(String phase, double pct, String status, String message) {
        AppUpdaterPlugin p = instance;
        if (p == null) return;
        JSObject d = new JSObject();
        d.put("phase", phase);
        d.put("pct", pct);
        if (status != null) d.put("status", status);
        if (message != null) d.put("message", message);
        p.notifyListeners("updateProgress", d);
    }

    private File apkFile() {
        return new File(getContext().getCacheDir(), "mise-a-jour.apk");
    }

    /** url : lien de l'APK ; token (facultatif) : jeton GitHub pour un dépôt privé (lien d'API de la pièce jointe). */
    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        String token = call.getString("token");
        if (url == null) { call.reject("lien manquant"); return; }
        cancelled = false;
        new Thread(() -> {
            HttpURLConnection con = null;
            try {
                /* redirections suivies à la main : le jeton ne part que vers GitHub, jamais vers le stockage des fichiers */
                String current = url;
                for (int i = 0; i < 5; i++) {
                    con = (HttpURLConnection) new URL(current).openConnection();
                    con.setInstanceFollowRedirects(false);
                    con.setConnectTimeout(20000);
                    con.setReadTimeout(30000);
                    con.setRequestProperty("User-Agent", "orfeo-updater");
                    con.setRequestProperty("Accept", "application/octet-stream");
                    if (token != null && !token.isEmpty() && current.startsWith("https://api.github.com/")) {
                        con.setRequestProperty("Authorization", "Bearer " + token);
                    }
                    int code = con.getResponseCode();
                    if (code >= 300 && code < 400) {
                        current = con.getHeaderField("Location");
                        con.disconnect();
                        if (current == null) throw new Exception("redirection sans adresse");
                        continue;
                    }
                    if (code != 200) throw new Exception("téléchargement refusé (" + code + ")");
                    break;
                }
                long total = con.getContentLengthLong();
                File out = apkFile();
                long done = 0;
                int last = -1;
                try (InputStream in = con.getInputStream(); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        if (cancelled) throw new Exception("annulé");
                        os.write(buf, 0, n);
                        done += n;
                        int pct = total > 0 ? (int) (done * 100 / total) : -1;
                        if (pct != last) { last = pct; emit("download", pct, null, null); }
                    }
                }
                JSObject r = new JSObject();
                r.put("size", done);
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "téléchargement impossible" : e.getMessage());
            } finally {
                if (con != null) con.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        cancelled = true;
        call.resolve();
    }

    /** Autorisation « installer des applications inconnues » pour cette application (demandée une seule fois). */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject r = new JSObject();
        r.put("allowed", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(r);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Installe l'APK téléchargé : copie dans une session d'installation (0 → 50 %), puis installation par Android (50 → 100 %). */
    @PluginMethod
    public void install(PluginCall call) {
        File apk = apkFile();
        if (!apk.exists()) { call.reject("aucune mise à jour téléchargée"); return; }
        new Thread(() -> {
            try {
                Context c = getContext();
                PackageInstaller pi = c.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(c.getPackageName());
                params.setSize(apk.length());
                int sessionId = pi.createSession(params);
                pi.registerSessionCallback(new PackageInstaller.SessionCallback() {
                    @Override public void onCreated(int id) {}
                    @Override public void onBadgingChanged(int id) {}
                    @Override public void onActiveChanged(int id, boolean active) {}
                    @Override public void onProgressChanged(int id, float progress) {
                        if (id == sessionId) emit("install", Math.round(Math.max(50, progress * 100)), null, null);
                    }
                    @Override public void onFinished(int id, boolean success) {}
                }, new android.os.Handler(android.os.Looper.getMainLooper()));
                try (PackageInstaller.Session session = pi.openSession(sessionId)) {
                    long total = apk.length(), done = 0;
                    int last = -1;
                    try (InputStream in = new FileInputStream(apk); OutputStream os = session.openWrite("base.apk", 0, total)) {
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            os.write(buf, 0, n);
                            done += n;
                            int pct = (int) (done * 50 / Math.max(1, total));
                            if (pct != last) { last = pct; emit("install", pct, null, null); session.setStagingProgress(done / (float) total); }
                        }
                        session.fsync(os);
                    }
                    Intent result = new Intent(c, InstallResultReceiver.class);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    PendingIntent pending = PendingIntent.getBroadcast(c, sessionId, result, flags);
                    session.commit(pending.getIntentSender());
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "installation impossible" : e.getMessage());
            }
        }).start();
    }
}
