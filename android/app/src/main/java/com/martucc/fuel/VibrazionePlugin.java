package com.martucc.fuel;

import android.os.Build;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Il tocco di sistema di Android, quello della tastiera: corto e leggero,
 * e segue l'impostazione «vibrazione al tocco» del telefono.
 *
 * Il plugin Haptics di Capacitor per la «selezione» fa una vibrazione
 * continua di 100 ms: a ogni cambio di scheda arrivava un ronzio. Qui
 * niente durate fatte a mano, decide il telefono. I tipi arrivano da
 * src/domain/vibrazione.ts.
 */
@CapacitorPlugin(name = "Vibrazione")
public class VibrazionePlugin extends Plugin {

    @PluginMethod
    public void tocca(PluginCall call) {
        int effetto = effetto(call.getString("tipo", "clic"));
        View vista = getBridge().getWebView();
        getActivity().runOnUiThread(() -> {
            vista.performHapticFeedback(effetto);
            call.resolve();
        });
    }

    private static int effetto(String tipo) {
        boolean android11 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R;
        switch (tipo) {
            case "scatto":
                return HapticFeedbackConstants.CLOCK_TICK;
            case "tasto":
                return HapticFeedbackConstants.VIRTUAL_KEY;
            case "conferma":
                return android11 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY;
            case "rifiuto":
                return android11 ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS;
            case "clic":
            default:
                return HapticFeedbackConstants.KEYBOARD_TAP;
        }
    }
}
