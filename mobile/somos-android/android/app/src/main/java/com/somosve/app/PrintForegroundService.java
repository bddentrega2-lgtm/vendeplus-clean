package com.somosve.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class PrintForegroundService extends Service {
    private static final String CHANNEL_ID = "somos_printing";
    private static final int NOTIFICATION_ID = 2106;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final AtomicBoolean polling = new AtomicBoolean(false);

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(NOTIFICATION_ID, notification("Impresion automatica activa"));
        scheduler.scheduleWithFixedDelay(this::poll, 0, 7, TimeUnit.SECONDS);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        scheduler.shutdownNow();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void poll() {
        if (!polling.compareAndSet(false, true)) return;
        try {
            SomosPrinterPlugin.QueueResult result = SomosPrinterPlugin.processPendingJobs(getApplicationContext());
            if (result.processed > 0) updateNotification(result.processed + " comanda(s) impresa(s)");
        } catch (Exception ignored) {
            updateNotification("Esperando conexion o impresora");
        } finally {
            polling.set(false);
        }
    }

    private void createChannel() {
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Impresion de comandas", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantiene activa la impresion automatica de SOMOS.");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private Notification notification(String text) {
        Intent openApp = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openApp, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("SOMOS")
            .setContentText(text)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build();
    }

    private void updateNotification(String text) {
        getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification(text));
    }
}
