package com.somosve.app;

import android.content.Context;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class PrinterServerConfig {
    private static final String OFFICIAL_ORIGIN = "https://www.somos-ve.com";
    private static final String PREVIEW_HOST = "vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\\.vercel\\.app";

    private PrinterServerConfig() {}

    static String apiUrl(Context context, String path) throws Exception {
        String origin = configuredOrigin(context);
        return origin + (path.startsWith("/") ? path : "/" + path);
    }

    private static String configuredOrigin(Context context) throws Exception {
        try (InputStream input = context.getAssets().open("capacitor.config.json")) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            JSONObject config = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
            JSONObject server = config.optJSONObject("server");
            String candidate = server == null ? OFFICIAL_ORIGIN : server.optString("url", OFFICIAL_ORIGIN).trim();
            URL url = new URL(candidate);
            boolean official = candidate.equals(OFFICIAL_ORIGIN);
            boolean preview = url.getProtocol().equals("https") && url.getHost().matches(PREVIEW_HOST)
                && url.getPort() == -1 && (url.getPath().isEmpty() || url.getPath().equals("/"))
                && url.getQuery() == null && url.getRef() == null && url.getUserInfo() == null;
            if (official || preview) return url.getProtocol() + "://" + url.getHost();
            if (candidate.equals("http://localhost:3107")) return OFFICIAL_ORIGIN;
            throw new SecurityException("Origen de impresion no autorizado.");
        }
    }
}
