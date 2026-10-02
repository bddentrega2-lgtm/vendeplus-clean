package com.somosve.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public class PrintForegroundService extends Service {
    private static final String CHANNEL_ID = "somos_printing";
    private static final int NOTIFICATION_ID = 2106;
    private static final int MAX_SUCCESSFUL_BATCHES = 4;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean draining = new AtomicBoolean(false);
    private final AtomicBoolean rerun = new AtomicBoolean(false);
    private final AtomicInteger latestStartId = new AtomicInteger(0);

    static boolean start(Context context) {
        try {
            ContextCompat.startForegroundService(context, new Intent(context, PrintForegroundService.class));
            return true;
        } catch (RuntimeException error) {
            return false;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(NOTIFICATION_ID, notification("Revisando comandas pendientes"));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        latestStartId.set(startId);
        rerun.set(true);
        drainQueue();
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void drainQueue() {
        if (!draining.compareAndSet(false, true)) return;
        executor.execute(() -> {
            int batches = 0;
            try {
                while (rerun.getAndSet(false) && batches < MAX_SUCCESSFUL_BATCHES) {
                    SomosPrinterPlugin.QueueResult result = SomosPrinterPlugin.processPendingJobs(getApplicationContext());
                    batches++;
                    if (result.processed > 0) updateNotification(result.processed + " comanda(s) impresa(s)");
                    if (result.claimed == 3 && result.processed == result.claimed) rerun.set(true);
                }
            } catch (Exception error) {
                updateNotification("No se pudo completar la impresion");
            } finally {
                int completedStartId = latestStartId.get();
                draining.set(false);
                if (rerun.get()) {
                    drainQueue();
                } else if (stopSelfResult(completedStartId)) {
                    stopForeground(STOP_FOREGROUND_REMOVE);
                }
            }
        });
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Impresion de comandas", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Muestra cuando SOMOS procesa comandas para una impresora vinculada.");
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
