package com.somosve.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class PrinterSecureStore {
    private static final String KEY_ALIAS = "somos_print_agent_token";
    private static final String PREFS = "somos_printer";
    private static final String TOKEN = "device_token";
    private static final String TOKEN_IV = "device_token_iv";
    private static final String ACTIVE_STORE = "active_store_id";
    private final SharedPreferences preferences;

    PrinterSecureStore(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    void saveToken(String storeId, String deviceId, String token) throws Exception {
        if (!storeId.equals(activeStoreId()) || storeId.isEmpty()) throw new IllegalStateException("Comercio no activo");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        preferences.edit()
            .putString(scoped(TOKEN, storeId), Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .putString(scoped(TOKEN_IV, storeId), Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .putString(scoped("device_id", storeId), deviceId)
            .apply();
    }

    String readToken() throws Exception {
        String storeId = activeStoreId();
        if (storeId.isEmpty()) return "";
        String encrypted = preferences.getString(scoped(TOKEN, storeId), "");
        String iv = preferences.getString(scoped(TOKEN_IV, storeId), "");
        if (encrypted.isEmpty() || iv.isEmpty()) return "";
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    void savePrinter(String address, String name) {
        preferences.edit().putString("printer_address", address).putString("printer_name", name).apply();
    }

    String printerAddress() { return preferences.getString("printer_address", ""); }
    String printerName() { return preferences.getString("printer_name", ""); }
    void activateStore(String storeId) { preferences.edit().putString(ACTIVE_STORE, storeId).commit(); }
    String activeStoreId() { return preferences.getString(ACTIVE_STORE, ""); }
    String deviceId() {
        String storeId = activeStoreId();
        return storeId.isEmpty() ? "" : preferences.getString(scoped("device_id", storeId), "");
    }
    boolean hasLegacyToken() { return preferences.contains(TOKEN) && preferences.contains(TOKEN_IV); }
    void setAutoPrintEnabled(boolean enabled) {
        String storeId = activeStoreId();
        if (!storeId.isEmpty()) preferences.edit().putBoolean(scoped("auto_print", storeId), enabled).apply();
    }
    boolean autoPrintEnabled() {
        String storeId = activeStoreId();
        return !storeId.isEmpty() && preferences.getBoolean(scoped("auto_print", storeId), false);
    }

    void clearPairing() {
        String storeId = activeStoreId();
        if (!storeId.isEmpty()) preferences.edit()
            .remove(scoped(TOKEN, storeId)).remove(scoped(TOKEN_IV, storeId))
            .remove(scoped("device_id", storeId)).remove(scoped("auto_print", storeId)).apply();
    }

    boolean hasToken() {
        String storeId = activeStoreId();
        return !storeId.isEmpty() && preferences.contains(scoped(TOKEN, storeId)) && preferences.contains(scoped(TOKEN_IV, storeId));
    }

    private String scoped(String key, String storeId) { return key + "_" + storeId; }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
        return generator.generateKey();
    }
}
