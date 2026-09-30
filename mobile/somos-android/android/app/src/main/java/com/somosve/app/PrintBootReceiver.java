package com.somosve.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class PrintBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PrinterSecureStore store = new PrinterSecureStore(context);
        if (store.autoPrintEnabled() && store.hasToken() && !store.printerAddress().isEmpty()) {
            context.startForegroundService(new Intent(context, PrintForegroundService.class));
        }
    }
}
