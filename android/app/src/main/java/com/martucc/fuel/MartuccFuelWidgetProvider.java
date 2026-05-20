package com.martucc.fuel;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Log;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MartuccFuelWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "MartuccWidget";

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
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, MartuccFuelWidgetProvider.class));
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            }
        } else if ("com.martucc.fuel.TOGGLE_STYLE".equals(action)) {
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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.martucc_fuel_widget);

        // 1. Carica i dati condivisi dalle preferenze di Capacitor (Shared Preferences name: "CapacitorStorage")
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        
        // Applica lo stile dello sfondo ciclico (specifico per widget o globale come fallback)
        int style = prefs.getInt("mf_widget_style_" + appWidgetId, prefs.getInt("mf_widget_style", 0));
        int bgDrawable = R.drawable.widget_background; // OLED scuro
        if (style == 1) {
            bgDrawable = R.drawable.widget_background_semi; // Glassmorphism
        } else if (style == 2) {
            bgDrawable = R.drawable.widget_background_transparent; // Trasparente
        }
        views.setInt(R.id.widget_root, "setBackgroundResource", bgDrawable);

        // Auto-sincronizzazione nativa asincrona se i dati sono più vecchi di 4 ore
        String lastFetchStr = prefs.getString("mf_last_fetch_time", "0");
        long lastFetch = Long.parseLong(lastFetchStr);
        if (lastFetch == 0 || (System.currentTimeMillis() - lastFetch > 4 * 60 * 60 * 1000)) {
            Log.d(TAG, "Prezzi più vecchi di 4 ore rilevati dal Widget Principale. Avvio sync nativo.");
            FuelDataSyncManager.sync(context);
        }

        String stationName = prefs.getString("mf_widget_cheapest_name", "Apri l'app...");
        String priceVal = prefs.getString("mf_widget_cheapest_price", "---");
        String aiTip = prefs.getString("mf_widget_ai_tip", "💡 Apri Martucc Fuel");
        
        String weatherIcon = prefs.getString("mf_widget_weather_icon", "☀️");
        String weatherTemp = prefs.getString("mf_widget_weather_temp", "20°C");
        String weatherDesc = prefs.getString("mf_widget_weather_desc", "Soleggiato");

        // 2. Popola i dati dell'interfaccia
        views.setTextViewText(R.id.widget_fuel_station, stationName);
        views.setTextViewText(R.id.widget_fuel_price, priceVal);
        views.setTextViewText(R.id.widget_ai_tip, aiTip);
        
        views.setTextViewText(R.id.widget_weather_icon, weatherIcon);
        views.setTextViewText(R.id.widget_weather_temp, weatherTemp);
        views.setTextViewText(R.id.widget_weather_desc, weatherDesc);

        // Imposta la data corrente
        try {
            SimpleDateFormat df = new SimpleDateFormat("EEE, dd MMM", Locale.ITALIAN);
            String dateStr = df.format(new Date());
            if (dateStr.length() > 0) {
                dateStr = dateStr.substring(0, 1).toUpperCase() + dateStr.substring(1);
            }
            views.setTextViewText(R.id.widget_date, dateStr);
        } catch (Exception e) {
            views.setTextViewText(R.id.widget_date, "Oggi");
        }

        // 3. Configura le scorciatoie al tocco (PendingIntents)

        // TOCCARE METEO: Prova a lanciare l'app meteo nativa dei vari brand in sequenza
        Intent weatherIntent = null;
        String[] weatherPackages = {
                "com.sec.android.app.weather",        // Samsung Weather
                "com.sec.android.easyMeteo",          // Samsung EasyMeteo
                "com.miui.weather2",                  // Xiaomi Weather
                "com.huawei.android.totemweather",    // Huawei Weather
                "com.oneplus.weather",                // OnePlus Weather
                "com.google.android.apps.weather",    // Google Weather App
                "com.htc.weather",                    // HTC Weather
                "com.lenovo.weather"                  // Lenovo Weather
        };
        for (String pkg : weatherPackages) {
            weatherIntent = context.getPackageManager().getLaunchIntentForPackage(pkg);
            if (weatherIntent != null) {
                break;
            }
        }
        if (weatherIntent == null) {
            weatherIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=meteo"));
        }
        PendingIntent weatherPI = PendingIntent.getActivity(
                context, 31, weatherIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_weather_layout, weatherPI);

        // TOCCARE IL CENTRO (CARBURANTE): Apre Martucc Fuel
        Intent appIntent = context.getPackageManager().getLaunchIntentForPackage("com.martucc.fuel");
        if (appIntent == null) {
            appIntent = new Intent(context, MainActivity.class);
        }
        PendingIntent appPI = PendingIntent.getActivity(
                context, 32, appIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_fuel_layout, appPI);

        // TOCCARE IL CLOCK (DESTRA): Apre Orologio Samsung o di default
        Intent clockIntent = context.getPackageManager().getLaunchIntentForPackage("com.sec.android.app.clockpackage");
        if (clockIntent == null) {
            clockIntent = context.getPackageManager().getLaunchIntentForPackage("com.google.android.deskclock");
        }
        if (clockIntent == null) {
            clockIntent = context.getPackageManager().getLaunchIntentForPackage("com.android.deskclock");
        }
        if (clockIntent == null) {
            clockIntent = new Intent("android.intent.action.SHOW_ALARMS");
        }
        PendingIntent clockPI = PendingIntent.getActivity(
                context, 33, clockIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_clock_layout, clockPI);

        // Cliccare il pulsante "🎨" per cambiare lo stile del widget
        Intent styleIntent = new Intent("com.martucc.fuel.TOGGLE_STYLE");
        styleIntent.setPackage(context.getPackageName());
        PendingIntent stylePI = PendingIntent.getBroadcast(
                context, 34, styleIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_style_btn, stylePI);

        // 4. Notifica il manager del widget dell'avvenuto aggiornamento
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
