package com.martucc.fuel;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/**
 * Il Tabellone: il widget grande.
 *
 * Dice la stessa cosa che dice la Home quando la apri - lo stesso impianto,
 * lo stesso livello, le stesse parole - perche legge il consiglio gia
 * calcolato dall'app invece di rifarsi un conto suo. Prima ne faceva uno
 * proprio, e su due schermi comparivano due distributori diversi.
 */
public class MartuccFuelWidgetProvider extends AppWidgetProvider {

    static final String AZIONE_SFONDO = "com.martucc.fuel.RUOTA_SFONDO";
    static final String AZIONE_AGGIORNA = "com.martucc.fuel.UPDATE_WIDGET";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager gestore, int[] ids) {
        MfNotte.sincronizzaSeVecchio(ctx);
        for (int id : ids) disegna(ctx, gestore, id);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String azione = intent.getAction();

        if (AZIONE_SFONDO.equals(azione)) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,
                    AppWidgetManager.INVALID_APPWIDGET_ID);
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) MfNotte.ruotaSfondo(ctx, id);
            tuttiQuanti(ctx);
        } else if (AZIONE_AGGIORNA.equals(azione)) {
            tuttiQuanti(ctx);
        }
    }

    /**
     * Lo sfondo si ruota da un widget qualsiasi ma vanno ridisegnati tutti:
     * il tocco puo arrivare da un Tabellone e riguardare una Tacca.
     */
    private static void tuttiQuanti(Context ctx) {
        AppWidgetManager gestore = AppWidgetManager.getInstance(ctx);
        for (int id : gestore.getAppWidgetIds(new ComponentName(ctx, MartuccFuelWidgetProvider.class))) {
            disegna(ctx, gestore, id);
        }
        for (int id : gestore.getAppWidgetIds(new ComponentName(ctx, MartuccFuelCompactWidgetProvider.class))) {
            MartuccFuelCompactWidgetProvider.disegna(ctx, gestore, id);
        }
    }

    static void disegna(Context ctx, AppWidgetManager gestore, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.mf_widget_tabellone);
        MfNotte.dipingi(ctx, v, id, true);
        gestore.updateAppWidget(id, v);
    }
}
