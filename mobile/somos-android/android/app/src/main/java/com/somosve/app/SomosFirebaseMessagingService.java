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
        String type = message.getData().get("type");
        if ("print_jobs".equals(type)) {
            PrinterSecureStore store = new PrinterSecureStore(getApplicationContext());
            String messageStoreId = message.getData().get("storeId");
            if (messageStoreId == null || !messageStoreId.equals(store.activeStoreId()) || !store.hasToken()) return;
            SomosOrderAlertsPlugin.showRemote(this, message.getData().get("orderId"));
            if (store.autoPrintEnabled() && !store.printerAddress().isEmpty()) PrintForegroundService.start(this);
            return;
        }
        String id = message.getData().get("id");
        String path = message.getData().get("path");
        if ("commerce_order".equals(type)) {
            SomosOrderAlertsPlugin.showRemote(this, id, "Nuevo pedido en Somos", "Abre Pedidos para revisarlo.", path);
        } else if ("transport_order".equals(type)) {
            SomosOrderAlertsPlugin.showRemote(this, id, "Nuevo servicio de delivery", "Abre el panel para revisar el servicio.", path);
        } else if ("table_assistance".equals(type)) {
            String tableName = message.getData().get("tableName");
            SomosOrderAlertsPlugin.showRemote(this, message.getData().get("tableId") + ":" + message.getData().get("requestedAt"),
                "Solicitud de asistencia", (tableName == null || tableName.isEmpty() ? "Una mesa solicita asistencia." : tableName + " solicita asistencia."), "/panel/mesas");
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
