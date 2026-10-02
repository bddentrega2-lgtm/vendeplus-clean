package com.somosve.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
    private final Handler pageHandler = new Handler(Looper.getMainLooper());
    private LinearLayout recovery;
    private TextView recoveryText;
    private Button retry;
    private boolean pageFailed;
    private String startUrl;
    private String retryUrl;
    private final Runnable pageTimeout = () -> showRecovery(true);

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SomosPrinterPlugin.class);
        registerPlugin(SomosOrderAlertsPlugin.class);
        registerPlugin(SomosBuyerAuthPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge == null) return;
        startUrl = bridge.getConfig().getServerUrl();
        retryUrl = startUrl;
        createRecoveryView();
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                super.onPageStarted(view, url, icon);
                pageFailed = false;
                if (isAppOrigin(url)) retryUrl = url;
                showRecovery(false);
                pageHandler.removeCallbacks(pageTimeout);
                pageHandler.postDelayed(pageTimeout, 20000);
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pageHandler.removeCallbacks(pageTimeout);
                if (!pageFailed) recovery.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) { pageFailed = true; showRecovery(true); }
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                super.onReceivedHttpError(view, request, response);
                if (request.isForMainFrame() && response.getStatusCode() >= 500) { pageFailed = true; showRecovery(true); }
            }
        });
        showRecovery(false);
        pageHandler.postDelayed(pageTimeout, 20000);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(bridge.getWebView());
                if (insets != null && insets.isVisible(WindowInsetsCompat.Type.ime())) {
                    new WindowInsetsControllerCompat(getWindow(), bridge.getWebView()).hide(WindowInsetsCompat.Type.ime());
                    return;
                }
                if (recovery.getVisibility() == View.VISIBLE) { moveTaskToBack(true); return; }
                WebView web = bridge.getWebView();
                if (!isAppOrigin(web.getUrl())) { moveTaskToBack(true); return; }
                web.evaluateJavascript("typeof window.somosNativeBack === 'function' ? window.somosNativeBack() : null", result -> {
                    if ("true".equals(result)) return;
                    if ("false".equals(result)) { moveTaskToBack(true); return; }
                    if (web.canGoBack()) web.goBack(); else moveTaskToBack(true);
                });
            }
        });
    }

    private boolean isAppOrigin(String url) {
        if (url == null || startUrl == null) return false;
        Uri target = Uri.parse(url), start = Uri.parse(startUrl);
        return java.util.Objects.equals(target.getScheme(), start.getScheme())
            && java.util.Objects.equals(target.getHost(), start.getHost()) && target.getPort() == start.getPort();
    }

    private void createRecoveryView() {
        recovery = new LinearLayout(this);
        recovery.setOrientation(LinearLayout.VERTICAL);
        recovery.setGravity(Gravity.CENTER);
        recovery.setPadding(40, 40, 40, 40);
        recovery.setBackgroundColor(Color.WHITE);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        recovery.addView(logo, new LinearLayout.LayoutParams(160, 160));
        recoveryText = new TextView(this);
        recoveryText.setTextColor(Color.rgb(20, 61, 66));
        recoveryText.setTextSize(18);
        recoveryText.setGravity(Gravity.CENTER);
        recoveryText.setPadding(0, 32, 0, 24);
        recovery.addView(recoveryText);
        retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(v -> { showRecovery(false); bridge.getWebView().loadUrl(isAppOrigin(retryUrl) ? retryUrl : startUrl); });
        recovery.addView(retry);
        addContentView(recovery, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void showRecovery(boolean failed) {
        if (recovery == null) return;
        recoveryText.setText(failed ? "No pudimos conectar con Somos.\nRevisa tu conexion y vuelve a intentar." : "Abriendo Somos...");
        retry.setVisibility(failed ? View.VISIBLE : View.GONE);
        recovery.setVisibility(View.VISIBLE);
    }

    @Override public void onDestroy() {
        pageHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
