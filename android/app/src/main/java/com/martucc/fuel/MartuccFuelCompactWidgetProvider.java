package com.martucc.fuel;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.widget.RemoteViews;

public class MartuccFuelCompactWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "MartuccCompactWidget";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        Log.d(TAG, "Ricevuto broadcast intent con azione: " + action);

        if ("com.martucc.fuel.UPDATE_WIDGET".equals(action)) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, MartuccFuelCompactWidgetProvider.class));
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            }
        } else if ("com.martucc.fuel.TOGGLE_STYLE".equals(action)) {
            // Condivide lo stile con tutti gli altri widget
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            int style = prefs.getInt("mf_widget_style", 0);
            style = (style + 1) % 3; // OLED -> Glass -> Transparent
            prefs.edit().putInt("mf_widget_style", style).apply();

            // Forza il ridisegno di tutti i widget
            Intent updateIntent = new Intent("com.martucc.fuel.UPDATE_WIDGET");
            updateIntent.setPackage(context.getPackageName());
            context.sendBroadcast(updateIntent);
        }
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.martucc_fuel_compact_widget);

        // Load data from Capacitor Storage
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

        // Applica lo stile dello sfondo ciclico (specifico per widget o globale come fallback)
        int style = prefs.getInt("mf_widget_style_" + appWidgetId, prefs.getInt("mf_widget_style", 0));
        int bgDrawable = R.drawable.widget_background; // OLED scuro
        if (style == 1) {
            bgDrawable = R.drawable.widget_background_semi; // Glassmorphism
        } else if (style == 2) {
            bgDrawable = R.drawable.widget_background_transparent; // Trasparente
        }
        views.setInt(R.id.widget_compact_layout, "setBackgroundResource", bgDrawable);

        // Auto-sincronizzazione nativa asincrona se i dati sono più vecchi di 4 ore
        String lastFetchStr = prefs.getString("mf_last_fetch_time", "0");
        long lastFetch = Long.parseLong(lastFetchStr);
        if (lastFetch == 0 || (System.currentTimeMillis() - lastFetch > 4 * 60 * 60 * 1000)) {
            Log.d(TAG, "Prezzi più vecchi di 4 ore rilevati dal Widget Compatto. Avvio sync nativo.");
            FuelDataSyncManager.sync(context);
        }

        String stationName = prefs.getString("mf_widget_closest_name", "Apri l'app...");
        String priceVal = prefs.getString("mf_widget_closest_price", "---");
        String aiTip = prefs.getString("mf_widget_closest_ai_tip", "💡 Apri Martucc Fuel");

        // Set layout data
        views.setTextViewText(R.id.widget_compact_station, stationName);
        views.setTextViewText(R.id.widget_compact_price, priceVal);
        views.setTextViewText(R.id.widget_compact_ai_tip, aiTip);

        // Configure click action (Open App)
        Intent appIntent = context.getPackageManager().getLaunchIntentForPackage("com.martucc.fuel");
        if (appIntent == null) {
            appIntent = new Intent(context, MainActivity.class);
        }
        PendingIntent appPI = PendingIntent.getActivity(
                context, 10, appIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_compact_layout, appPI);

        // Update widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
