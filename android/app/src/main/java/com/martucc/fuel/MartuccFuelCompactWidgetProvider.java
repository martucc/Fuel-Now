package com.martucc.fuel;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/**
 * La Tacca: il widget piccolo.
 *
 * Mostrava il distributore piu vicino invece del piu conveniente, cioe una
 * risposta a una domanda che nessuno faceva. Ora dice lo stesso del
 * Tabellone, solo con meno parole.
 */
public class MartuccFuelCompactWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager gestore, int[] ids) {
        MfNotte.sincronizzaSeVecchio(ctx);
        for (int id : ids) disegna(ctx, gestore, id);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String azione = intent.getAction();

        if (MartuccFuelWidgetProvider.AZIONE_SFONDO.equals(azione)) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,
                    AppWidgetManager.INVALID_APPWIDGET_ID);
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) MfNotte.ruotaSfondo(ctx, id);
        }
        if (MartuccFuelWidgetProvider.AZIONE_SFONDO.equals(azione)
                || MartuccFuelWidgetProvider.AZIONE_AGGIORNA.equals(azione)) {
            AppWidgetManager gestore = AppWidgetManager.getInstance(ctx);
            for (int id : gestore.getAppWidgetIds(
                    new ComponentName(ctx, MartuccFuelCompactWidgetProvider.class))) {
                disegna(ctx, gestore, id);
            }
        }
    }

    static void disegna(Context ctx, AppWidgetManager gestore, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.mf_widget_tacca);
        MfNotte.dipingi(ctx, v, id, false);
        gestore.updateAppWidget(id, v);
    }
}
