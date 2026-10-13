package com.martucc.fuel;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // I plugin dell'app vanno registrati prima che parta il bridge.
        registerPlugin(NavigazionePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
