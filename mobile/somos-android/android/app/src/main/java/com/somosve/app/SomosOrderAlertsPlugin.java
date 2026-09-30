package com.somosve.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.provider.Settings;
import android.content.Context;
import android.content.SharedPreferences;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.LinkedHashSet;
import java.util.Set;

@CapacitorPlugin(name = "SomosOrderAlerts", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class SomosOrderAlertsPlugin extends Plugin {
    private static final String CHANNEL = "somos_orders_v1";
    private final LinkedHashSet<String> delivered = new LinkedHashSet<>();

    private static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Pedidos nuevos", NotificationManager.IMPORTANCE_HIGH);
        channel.enableVibration(true);
        channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private void createChannel() { createChannel(getContext()); }

    private boolean allowed() {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = getContext().getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);
            return channel != null && channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
        }
        return true;
    }

    @PluginMethod public void status(PluginCall call) {
        createChannel();
        JSObject result = new JSObject();
        result.put("granted", allowed());
        call.resolve(result);
    }

    @PluginMethod public void enable(PluginCall call) {
        createChannel();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !allowed()) {
            requestPermissionForAlias("notifications", call, "permissionResult");
        } else status(call);
    }

    @PermissionCallback private void permissionResult(PluginCall call) { status(call); }

    @PluginMethod public void settings(PluginCall call) {
        createChannel();
        Intent intent = new Intent(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS : Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            intent.putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL);
        } else intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod public void show(PluginCall call) {
        createChannel();
        String id = call.getString("id", "");
        if (id.isEmpty() || id.length() > 300) { call.reject("Aviso invalido"); return; }
        if (!allowed()) { call.reject("Notificaciones desactivadas"); return; }
        if (delivered.contains(id)) { call.resolve(); return; }
        boolean test = Boolean.TRUE.equals(call.getBoolean("test", false));
        Intent intent = new Intent(getContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(getContext(), 31, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        // Generic lock-screen content avoids leaking customer or commerce details.
        NotificationCompat.Builder notification = new NotificationCompat.Builder(getContext(), CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(test ? "Prueba de aviso Somos" : "Nuevo pedido en Somos")
            .setContentText(test ? "Sonido y notificacion de prueba." : "Abre el panel para revisar el pedido.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_SOUND | NotificationCompat.DEFAULT_VIBRATE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(content).setAutoCancel(true).setOnlyAlertOnce(true);
        try {
            NotificationManagerCompat.from(getContext()).notify("somos-order:" + id, 31, notification.build());
            delivered.add(id);
            if (delivered.size() > 100) {
                String oldest = delivered.iterator().next();
                NotificationManagerCompat.from(getContext()).cancel("somos-order:" + oldest, 31);
                delivered.remove(oldest);
            }
            call.resolve();
        } catch (SecurityException error) { call.reject("Notificaciones desactivadas"); }
    }

    @PluginMethod public void clear(PluginCall call) {
        for (String id : delivered) NotificationManagerCompat.from(getContext()).cancel("somos-order:" + id, 31);
        delivered.clear();
        call.resolve();
    }

    static synchronized void showRemote(Context context, String id) {
        if (id == null || id.isEmpty() || id.length() > 300) return;
        createChannel(context);
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return;
        SharedPreferences preferences = context.getSharedPreferences("somos_remote_orders", Context.MODE_PRIVATE);
        Set<String> stored = preferences.getStringSet("delivered", java.util.Collections.emptySet());
        LinkedHashSet<String> ids = new LinkedHashSet<>(stored);
        if (ids.contains(id)) return;
        Intent intent = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(context, 32, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Nuevo pedido en Somos")
            .setContentText("Abre el panel para revisar el pedido.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_SOUND | NotificationCompat.DEFAULT_VIBRATE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(content).setAutoCancel(true).setOnlyAlertOnce(true);
        try {
            NotificationManagerCompat.from(context).notify("somos-remote-order:" + id, 32, notification.build());
            ids.add(id);
            while (ids.size() > 100) ids.remove(ids.iterator().next());
            preferences.edit().putStringSet("delivered", ids).apply();
        } catch (SecurityException ignored) {}
    }
}
