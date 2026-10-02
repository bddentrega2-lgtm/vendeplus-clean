package com.somosve.app;

import android.content.Context;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

public class SomosFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TOKEN_PATH = "/api/printing-agent/push-token";

    @Override
    public void onNewToken(String token) {
        registerToken(getApplicationContext(), token);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        if (!"print_jobs".equals(message.getData().get("type"))) return;
        SomosOrderAlertsPlugin.showRemote(this, message.getData().get("orderId"));
        PrinterSecureStore store = new PrinterSecureStore(getApplicationContext());
        if (store.autoPrintEnabled() && store.hasToken() && !store.printerAddress().isEmpty()) {
            PrintForegroundService.start(this);
        }
    }

    static void registerToken(Context context, String pushToken) {
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                String deviceToken = new PrinterSecureStore(context).readToken();
                if (deviceToken.isEmpty() || pushToken == null || pushToken.isEmpty()) return;
                HttpURLConnection connection = (HttpURLConnection) new URL(PrinterServerConfig.apiUrl(context, TOKEN_PATH)).openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(10_000);
                connection.setRequestProperty("Authorization", "Bearer " + deviceToken);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);
                byte[] payload = new JSONObject().put("token", pushToken).toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) { output.write(payload); }
                connection.getResponseCode();
                connection.disconnect();
            } catch (Exception ignored) {}
        });
    }
}
