package com.martucc.fuel;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d("MainActivity", "Avvio dell'applicazione. Configurazione allarme sveglia...");
        try {
            MartuccAlarmScheduler.scheduleAlarm(this);
        } catch (Exception e) {
            e.printStackTrace();
        }
        // Nessun ritocco alle WebSettings: DOM storage e database Capacitor
        // li accende gia, mentre accesso ai file e contenuti misti erano solo
        // superficie in piu per un'app che parla unicamente in https.
    }

    @Override
    public void onPause() {
        super.onPause();
        try {
            Intent intent = new Intent("com.martucc.fuel.UPDATE_WIDGET");
            intent.setPackage(getPackageName());
            sendBroadcast(intent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
