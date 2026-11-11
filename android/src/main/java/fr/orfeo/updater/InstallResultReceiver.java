package fr.orfeo.updater;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/** Réponse de l'installateur d'Android : confirmation à demander, succès ou échec. */
public class InstallResultReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(confirm);
            }
            AppUpdaterPlugin.emit("install", 50, "confirm", null);
        } else if (status == PackageInstaller.STATUS_SUCCESS) {
            AppUpdaterPlugin.emit("install", 100, "success", null);
        } else {
            AppUpdaterPlugin.emit("install", 0, "failure", message == null ? "installation annulée ou refusée" : message);
        }
    }
}
