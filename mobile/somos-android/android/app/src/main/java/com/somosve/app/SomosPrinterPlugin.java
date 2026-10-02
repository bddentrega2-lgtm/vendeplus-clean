package com.somosve.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.content.Context;
import android.content.Intent;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONArray;
import org.json.JSONObject;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import androidx.core.content.ContextCompat;

@CapacitorPlugin(
    name = "SomosPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        ),
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class SomosPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String JOBS_PATH = "/api/printing-agent/jobs";
    private final ExecutorService printerExecutor = Executors.newSingleThreadExecutor();
    private PrinterSecureStore secureStore;

    @Override
    public void load() {
        secureStore = new PrinterSecureStore(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        printerExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        JSObject result = new JSObject();
        result.put("supported", adapter != null);
        result.put("enabled", adapter != null && adapter.isEnabled());
        result.put("permission", hasBluetoothPermission());
        result.put("paired", secureStore.hasToken());
        result.put("printerAddress", secureStore.printerAddress());
        result.put("printerName", secureStore.printerName());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || hasBluetoothPermission()) {
            resolvePermission(call);
            return;
        }
        requestAllPermissions(call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        resolvePermission(call);
    }

    @PluginMethod
    @SuppressLint("MissingPermission")
    public void getPairedPrinters(PluginCall call) {
        if (!requireBluetooth(call)) return;

        BluetoothAdapter adapter = getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Activa Bluetooth para ver las impresoras vinculadas.", "BLUETOOTH_DISABLED");
            return;
        }

        JSArray printers = new JSArray();
        Set<BluetoothDevice> devices = adapter.getBondedDevices();
        for (BluetoothDevice device : devices) {
            JSObject printer = new JSObject();
            printer.put("name", device.getName() == null ? "Dispositivo Bluetooth" : device.getName());
            printer.put("address", device.getAddress());
            printer.put("type", device.getType());
            printers.put(printer);
        }

        JSObject result = new JSObject();
        result.put("printers", printers);
        call.resolve(result);
    }

    @PluginMethod
    public void printTest(PluginCall call) {
        if (!requireBluetooth(call)) return;

        String address = call.getString("address", "").trim();
        if (!BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("Selecciona una impresora Bluetooth valida.", "INVALID_ADDRESS");
            return;
        }

        printerExecutor.execute(() -> printDiagnosticTicket(call, address));
    }

    @PluginMethod
    public void selectPrinter(PluginCall call) {
        if (!requireBluetooth(call)) return;
        String address = call.getString("address", "").trim();
        String name = call.getString("name", "Impresora Bluetooth").trim();
        if (!BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("Selecciona una impresora Bluetooth valida.", "INVALID_ADDRESS");
            return;
        }
        secureStore.savePrinter(address, name);
        JSObject result = new JSObject();
        result.put("saved", true);
        call.resolve(result);
    }

    @PluginMethod
    public void savePairingToken(PluginCall call) {
        String token = call.getString("token", "").trim();
        if (!token.matches("^sdp_[A-Za-z0-9_-]{40,}$")) {
            call.reject("El token del equipo no es valido.", "INVALID_TOKEN");
            return;
        }
        try {
            secureStore.saveToken(token);
            JSObject result = new JSObject();
            result.put("saved", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo proteger la vinculacion en este telefono.", "SECURE_STORAGE_FAILED", error);
        }
    }

    @PluginMethod
    public void clearPairing(PluginCall call) {
        secureStore.clearPairing();
        JSObject result = new JSObject();
        result.put("cleared", true);
        call.resolve(result);
    }

    @PluginMethod
    public void processQueue(PluginCall call) {
        if (!requireBluetooth(call)) return;
        if (secureStore.printerAddress().isEmpty()) {
            call.reject("Selecciona primero una impresora.", "PRINTER_REQUIRED");
            return;
        }
        printerExecutor.execute(() -> {
            try {
                QueueResult queue = processPendingJobs(getContext());
                JSObject result = new JSObject();
                result.put("processed", queue.processed);
                result.put("claimed", queue.claimed);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("No se pudo consultar o imprimir la cola.", "QUEUE_FAILED", error);
            }
        });
    }

    @PluginMethod
    public void setAutoPrint(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        Intent intent = new Intent(getContext(), PrintForegroundService.class);
        if (enabled) {
            if (!secureStore.hasToken() || secureStore.printerAddress().isEmpty()) {
                call.reject("Vincula el telefono y selecciona una impresora primero.", "SETUP_REQUIRED");
                return;
            }
            secureStore.setAutoPrintEnabled(true);
            if (!PrintForegroundService.start(getContext())) {
                secureStore.setAutoPrintEnabled(false);
                call.reject("Android no permitio iniciar la impresion automatica.", "BACKGROUND_START_BLOCKED");
                return;
            }
        } else {
            secureStore.setAutoPrintEnabled(false);
            getContext().stopService(intent);
        }
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void registerPush(PluginCall call) {
        if (FirebaseApp.getApps(getContext()).isEmpty()) {
            call.reject("Firebase aun no esta configurado en esta instalacion.", "FIREBASE_NOT_CONFIGURED");
            return;
        }
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                call.reject("No se pudo registrar este telefono para notificaciones.", "PUSH_TOKEN_FAILED");
                return;
            }
            SomosFirebaseMessagingService.registerToken(getContext(), task.getResult());
            JSObject result = new JSObject();
            result.put("registered", true);
            call.resolve(result);
        });
    }

    static QueueResult processPendingJobs(Context context) throws Exception {
            PrinterSecureStore store = new PrinterSecureStore(context);
            String token = store.readToken();
            if (token.isEmpty()) throw new Exception("Telefono no vinculado");
            JSONObject response = requestJobs(context, "POST", token, null);
            JSONArray jobs = response.optJSONArray("jobs");
            JSONObject settings = response.optJSONObject("settings");
            if (jobs == null || jobs.length() == 0) {
                return new QueueResult(0, 0);
            }

            int width = settings == null ? 58 : settings.optInt("paper_width_mm", 58);
            int copies = settings == null ? 1 : Math.max(1, Math.min(3, settings.optInt("copies", 1)));
            boolean includePrices = settings != null && settings.optBoolean("include_prices", false);
            int printed = 0;
            for (int index = 0; index < jobs.length(); index++) {
                JSONObject job = jobs.getJSONObject(index);
                String jobId = job.getString("id");
                try {
                    byte[] ticket = buildOrderTicket(job.getJSONObject("order"), width, includePrices);
                    for (int copy = 0; copy < copies; copy++) writeToPrinter(context, store.printerAddress(), ticket);
                    requestJobs(context, "PATCH", token, new JSONObject().put("jobId", jobId).put("status", "printed"));
                    printed++;
                } catch (Exception error) {
                    requestJobs(context, "PATCH", token, new JSONObject().put("jobId", jobId).put("status", "failed").put("error", safeError(error)));
                }
            }
            return new QueueResult(printed, jobs.length());
    }

    private static JSONObject requestJobs(Context context, String method, String token, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(PrinterServerConfig.apiUrl(context, JOBS_PATH)).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(15_000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");
        connection.setDoInput(true);
        if (body != null || method.equals("POST")) {
            connection.setDoOutput(true);
            byte[] payload = (body == null ? "{}" : body.toString()).getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) { output.write(payload); }
        }
        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        StringBuilder text = new StringBuilder();
        if (stream != null) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) text.append(line);
            }
        }
        connection.disconnect();
        if (status < 200 || status >= 300) throw new Exception("Servidor de impresion HTTP " + status);
        return text.length() == 0 ? new JSONObject() : new JSONObject(text.toString());
    }

    private static byte[] buildOrderTicket(JSONObject order, int paperWidth, boolean includePrices) throws Exception {
        int columns = paperWidth == 80 ? 48 : 32;
        String line = repeat('-', columns);
        StringBuilder text = new StringBuilder();
        JSONObject store = order.optJSONObject("stores");
        text.append(center(store == null ? "SOMOS" : jsonString(store, "name", "SOMOS"), columns)).append('\n');
        text.append(center("COMANDA " + jsonString(order, "public_code", ""), columns)).append('\n');
        text.append(line).append('\n');
        appendField(text, "Fecha", orderDate(jsonString(order, "created_at", "")));
        appendField(text, "Modalidad", fulfillmentLabel(jsonString(order, "delivery_type", "")));
        appendField(text, "Mesa", jsonString(order, "table_name_snapshot", ""));
        appendField(text, "Zona", jsonString(order, "table_zone_snapshot", ""));
        appendField(text, "Cliente", jsonString(order, "customer_name", ""));
        appendField(text, "Telefono", jsonString(order, "customer_phone", ""));
        String deliveryAddress = jsonString(order, "delivery_address", "");
        String deliveryReference = jsonString(order, "delivery_reference", "");
        appendWrappedField(text, "DIRECCION", deliveryAddress, columns);
        if (!sameText(deliveryAddress, deliveryReference)) {
            appendWrappedField(text, "REFERENCIA", deliveryReference, columns);
        }
        appendField(text, "Zona delivery", jsonString(order, "delivery_zone_name", ""));
        appendField(text, "Empresa delivery", jsonString(order, "transport_agency_name", ""));
        appendField(text, "Pago", jsonString(order, "payment_method", ""));
        appendField(text, "Referencia pago", jsonString(order, "payment_reference", ""));
        text.append(line).append('\n');
        JSONArray items = order.optJSONArray("order_items");
        if (items != null) {
            for (int index = 0; index < items.length(); index++) {
                JSONObject item = items.getJSONObject(index);
                String product = item.optInt("quantity", 1) + " x " + jsonString(item, "product_name", "Producto");
                if (includePrices) product += "  $" + money(item.optDouble("total_usd", 0));
                appendWrapped(text, product, columns, "");
                appendWrapped(text, jsonString(item, "variant_name", ""), columns, "  ");
                JSONArray options = item.optJSONArray("order_item_options");
                if (options != null) for (int optionIndex = 0; optionIndex < options.length(); optionIndex++) {
                    JSONObject option = options.getJSONObject(optionIndex);
                    String quantity = option.optInt("quantity", 1) > 1 ? option.optInt("quantity", 1) + " x " : "";
                    String group = jsonString(option, "option_group_name", "");
                    String optionLabel = (group.isEmpty() ? "" : group + ": ") + jsonString(option, "option_name", "");
                    if (includePrices && option.optDouble("price_delta_usd", 0) != 0) {
                        optionLabel += "  +$" + money(option.optDouble("price_delta_usd", 0));
                    }
                    appendWrapped(text, "+ " + quantity + optionLabel, columns, "  ");
                }
                String itemNotes = jsonString(item, "notes", "");
                if (!itemNotes.isEmpty()) appendWrapped(text, "NOTA: " + itemNotes, columns, "  ");
            }
        }
        String details = jsonString(order, "order_details", "");
        if (!details.isEmpty()) { text.append(line).append('\n'); appendWrapped(text, "DETALLES: " + details, columns, ""); }
        String notes = jsonString(order, "notes", "");
        if (!notes.isEmpty()) { text.append(line).append('\n'); appendWrapped(text, "NOTA PEDIDO: " + notes, columns, ""); }
        if (includePrices) {
            text.append(line).append('\n');
            text.append("SUBTOTAL: $").append(money(order.optDouble("subtotal_usd", 0))).append('\n');
            double delivery = order.optDouble("delivery_usd", 0);
            if (delivery > 0) text.append("DELIVERY: $").append(money(delivery)).append('\n');
            text.append("TOTAL USD: $").append(money(order.optDouble("total_usd", 0))).append('\n');
            double totalBs = order.optDouble("total_bs", 0);
            if (totalBs > 0) text.append("TOTAL BS: ").append(money(totalBs)).append('\n');
        }
        text.append(line).append("\n\n\n");

        byte[] content = text.toString().getBytes(Charset.forName("CP850"));
        byte[] ticket = new byte[content.length + 6];
        ticket[0] = 0x1B; ticket[1] = 0x40;
        ticket[2] = 0x1B; ticket[3] = 0x74; ticket[4] = 0x02;
        System.arraycopy(content, 0, ticket, 5, content.length);
        ticket[ticket.length - 1] = 0x0A;
        return ticket;
    }

    private static void writeToPrinter(Context context, String address, byte[] ticket) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            throw new SecurityException("Permiso Bluetooth no autorizado");
        }
        BluetoothManager manager = context.getSystemService(BluetoothManager.class);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) throw new Exception("Bluetooth apagado");
        BluetoothSocket socket = null;
        try {
            socket = adapter.getRemoteDevice(address).createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            OutputStream output = socket.getOutputStream();
            output.write(ticket);
            output.flush();
            Thread.sleep(350);
        } finally {
            if (socket != null) try { socket.close(); } catch (Exception ignored) {}
        }
    }

    private static String fulfillmentLabel(String value) {
        if (value.equals("delivery")) return "Delivery";
        if (value.equals("pickup")) return "Retiro";
        if (value.equals("table")) return "Mesa / Barra";
        if (value.equals("national_shipping")) return "Envio nacional";
        return value;
    }

    private static String orderDate(String value) {
        if (value.isEmpty()) return "";
        try {
            SimpleDateFormat source = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            source.setTimeZone(TimeZone.getTimeZone("UTC"));
            SimpleDateFormat output = new SimpleDateFormat("dd/MM/yyyy hh:mm a", Locale.US);
            output.setTimeZone(TimeZone.getTimeZone("America/Caracas"));
            return output.format(source.parse(value));
        } catch (Exception ignored) {
            return value.replace('T', ' ').replace("Z", "");
        }
    }

    private static String jsonString(JSONObject object, String key, String fallback) {
        if (object == null || !object.has(key) || object.isNull(key)) return fallback;
        String value = object.optString(key, fallback).trim();
        return value.equalsIgnoreCase("null") ? fallback : value;
    }

    private static void appendField(StringBuilder text, String label, String value) {
        if (!value.isEmpty() && !value.equals("null")) text.append(label).append(": ").append(value).append('\n');
    }

    private static void appendWrappedField(StringBuilder text, String label, String value, int columns) {
        if (!value.isEmpty() && !value.equals("null")) appendWrapped(text, label + ": " + value, columns, "");
    }

    private static boolean sameText(String left, String right) {
        return !left.isEmpty() && left.trim().equalsIgnoreCase(right.trim());
    }

    private static void appendWrapped(StringBuilder text, String value, int columns, String prefix) {
        String remaining = value == null ? "" : value.trim();
        if (remaining.isEmpty()) return;
        int available = Math.max(8, columns - prefix.length());
        while (remaining.length() > available) {
            int split = remaining.lastIndexOf(' ', available);
            if (split < 1) split = available;
            text.append(prefix).append(remaining, 0, split).append('\n');
            remaining = remaining.substring(split).trim();
        }
        if (!remaining.isEmpty()) text.append(prefix).append(remaining).append('\n');
    }

    private static String center(String value, int columns) {
        String safe = value.length() > columns ? value.substring(0, columns) : value;
        return repeat(' ', Math.max(0, (columns - safe.length()) / 2)) + safe;
    }

    private static String repeat(char value, int count) {
        StringBuilder output = new StringBuilder(count);
        for (int index = 0; index < count; index++) output.append(value);
        return output.toString();
    }

    private static String money(double value) { return String.format(java.util.Locale.US, "%.2f", value); }
    private static String safeError(Exception error) {
        String message = error.getMessage();
        return message == null || message.isEmpty() ? error.getClass().getSimpleName() : message.substring(0, Math.min(400, message.length()));
    }

    static final class QueueResult {
        final int processed;
        final int claimed;
        QueueResult(int processed, int claimed) { this.processed = processed; this.claimed = claimed; }
    }

    private void printDiagnosticTicket(PluginCall call, String address) {
        BluetoothSocket socket = null;
        try {
            BluetoothAdapter adapter = getAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Bluetooth esta apagado.", "BLUETOOTH_DISABLED");
                return;
            }

            BluetoothDevice device = adapter.getRemoteDevice(address);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();

            OutputStream output = socket.getOutputStream();
            output.write(new byte[] { 0x1B, 0x40 });
            output.write(new byte[] { 0x1B, 0x61, 0x01 });
            output.write(new byte[] { 0x1B, 0x45, 0x01 });
            output.write("SOMOS\n".getBytes(StandardCharsets.US_ASCII));
            output.write(new byte[] { 0x1B, 0x45, 0x00 });
            output.write("IMPRESION DE PRUEBA\n".getBytes(StandardCharsets.US_ASCII));
            output.write(new byte[] { 0x1B, 0x61, 0x00 });
            output.write("--------------------------------\n".getBytes(StandardCharsets.US_ASCII));
            output.write("Conexion Bluetooth: OK\n".getBytes(StandardCharsets.US_ASCII));
            output.write("App: Somos Android\n".getBytes(StandardCharsets.US_ASCII));
            output.write("Ancho inicial: 58 mm\n".getBytes(StandardCharsets.US_ASCII));
            output.write("--------------------------------\n\n\n".getBytes(StandardCharsets.US_ASCII));
            output.flush();
            Thread.sleep(350);

            JSObject result = new JSObject();
            result.put("sent", true);
            result.put("address", address);
            call.resolve(result);
        } catch (SecurityException error) {
            call.reject("SOMOS no tiene permiso para usar Bluetooth.", "PERMISSION_DENIED", error);
        } catch (Exception error) {
            call.reject("No se pudo conectar o enviar el ticket a la impresora.", "PRINT_FAILED", error);
        } finally {
            if (socket != null) {
                try {
                    socket.close();
                } catch (Exception ignored) {}
            }
        }
    }

    private BluetoothAdapter getAdapter() {
        BluetoothManager manager = getContext().getSystemService(BluetoothManager.class);
        return manager == null ? null : manager.getAdapter();
    }

    private boolean hasBluetoothPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return getPermissionState("bluetooth") == PermissionState.GRANTED &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean requireBluetooth(PluginCall call) {
        if (!hasBluetoothPermission()) {
            call.reject("Autoriza el acceso a dispositivos cercanos.", "PERMISSION_REQUIRED");
            return false;
        }
        return true;
    }

    private void resolvePermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasBluetoothPermission());
        call.resolve(result);
    }
}
