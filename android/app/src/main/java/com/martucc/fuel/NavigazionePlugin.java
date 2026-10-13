package com.martucc.fuel;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

/**
 * «Portami lì»: apre il distributore nel navigatore che l'utente sceglie.
 *
 * Il selettore di Android compare ogni volta (Intent.createChooser), anche
 * se in passato e stata scelta un'app «sempre»: e quello che Nico ha chiesto.
 * Un semplice link geo: dalla WebView andrebbe dritto all'app predefinita.
 */
@CapacitorPlugin(name = "Navigazione")
public class NavigazionePlugin extends Plugin {

    @PluginMethod
    public void apri(PluginCall call) {
        Double lat = call.getDouble("lat");
        Double lng = call.getDouble("lng");
        String nome = call.getString("nome", "Distributore");
        if (lat == null || lng == null) {
            call.reject("Coordinate mancanti");
            return;
        }

        String coordinate = String.format(Locale.US, "%.6f,%.6f", lat, lng);
        Uri uri = Uri.parse("geo:" + coordinate + "?q=" + coordinate + "(" + Uri.encode(nome) + ")");
        Intent vedi = new Intent(Intent.ACTION_VIEW, uri);
        Intent scegli = Intent.createChooser(vedi, getContext().getString(R.string.apri_con));
        scegli.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            getActivity().startActivity(scegli);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Nessun navigatore installato", "NESSUNA_APP");
        }
    }
}
