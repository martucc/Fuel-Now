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
