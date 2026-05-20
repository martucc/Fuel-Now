package com.martucc.fuel;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class DailySyncReceiver extends BroadcastReceiver {
    private static final String TAG = "DailySyncReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "Ricevuto evento di broadcast con azione: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || "com.martucc.fuel.DAILY_ALARM".equals(action)) {
            if ("com.martucc.fuel.DAILY_ALARM".equals(action)) {
                Log.d(TAG, "⏰ Sveglia delle 6:00 scattata! Avvio del sync asincrono nativo...");
                
                // Avvia il sync asincrono dei prezzi e della tessera mappa statica
                FuelDataSyncManager.sync(context);
            } else {
                Log.d(TAG, "Dispositivo avviato (BOOT_COMPLETED). Ripristino della programmazione della sveglia...");
            }
            
            // Ripianifica la sveglia per il giorno successivo
            MartuccAlarmScheduler.scheduleAlarm(context);
        }
    }
}
