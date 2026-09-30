package com.somosve.app;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SomosBuyerAuth")
public class SomosBuyerAuthPlugin extends Plugin {
    private String pendingBuyerUrl;
    private String pendingPanelUrl;

    private String redirectUrl() { return getContext().getPackageName() + "://buyer-auth"; }
    private String panelRedirectUrl() { return getContext().getPackageName() + "://panel-auth"; }

    @PluginMethod
    public void getRedirectUrl(PluginCall call) {
        JSObject result = new JSObject();
        result.put("url", redirectUrl());
        call.resolve(result);
    }

    @PluginMethod
    public void getPanelRedirectUrl(PluginCall call) {
        JSObject result = new JSObject();
        result.put("url", panelRedirectUrl());
        call.resolve(result);
    }

    private boolean isCallback(Uri uri, String host) {
        return uri != null && getContext().getPackageName().equals(uri.getScheme())
            && host.equals(uri.getHost()) && uri.getPort() == -1 && uri.getUserInfo() == null
            && (uri.getPath() == null || uri.getPath().isEmpty()) && uri.toString().length() <= 8192;
    }

    @Override
    protected synchronized void handleOnNewIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = intent.getData();
        if (isCallback(uri, "buyer-auth")) pendingBuyerUrl = uri.toString();
        if (isCallback(uri, "panel-auth")) pendingPanelUrl = uri.toString();
    }

    @PluginMethod
    public void open(PluginCall call) {
        String value = call.getString("url", "");
        Uri uri = Uri.parse(value);
        if (value.length() > 8192 || !"https".equals(uri.getScheme()) || uri.getHost() == null
            || !BuildConfig.BUYER_AUTH_HOST.equals(uri.getHost()) || uri.getPort() != -1 || uri.getUserInfo() != null
            || !"/auth/v1/authorize".equals(uri.getPath())
            || !"google".equals(uri.getQueryParameter("provider"))
            || !(redirectUrl().equals(uri.getQueryParameter("redirect_to")) || panelRedirectUrl().equals(uri.getQueryParameter("redirect_to")))
            || !"s256".equals(uri.getQueryParameter("code_challenge_method"))
            || uri.getQueryParameter("code_challenge") == null) {
            call.reject("Invalid sign-in URL");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
                call.resolve();
            } catch (Exception error) { call.reject("Could not open browser"); }
        });
    }

    @PluginMethod
    public synchronized void consume(PluginCall call) {
        Uri launch = getActivity().getIntent().getData();
        if (pendingBuyerUrl == null && isCallback(launch, "buyer-auth")) pendingBuyerUrl = launch.toString();
        if (isCallback(launch, "buyer-auth")) getActivity().getIntent().setData(null);
        JSObject result = new JSObject();
        if (pendingBuyerUrl != null) result.put("url", pendingBuyerUrl);
        pendingBuyerUrl = null;
        call.resolve(result);
    }

    @PluginMethod
    public synchronized void consumePanel(PluginCall call) {
        Uri launch = getActivity().getIntent().getData();
        if (pendingPanelUrl == null && isCallback(launch, "panel-auth")) pendingPanelUrl = launch.toString();
        if (isCallback(launch, "panel-auth")) getActivity().getIntent().setData(null);
        JSObject result = new JSObject();
        if (pendingPanelUrl != null) result.put("url", pendingPanelUrl);
        pendingPanelUrl = null;
        call.resolve(result);
    }
}
