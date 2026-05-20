package com.martucc.fuel;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.Log;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class MartuccFuelMapWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "MartuccMapWidget";

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
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, MartuccFuelMapWidgetProvider.class));
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            }
        } else if ("com.martucc.fuel.TOGGLE_STYLE".equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            int style = prefs.getInt("mf_widget_style", 0);
            style = (style + 1) % 3; // OLED -> Glass -> Transparent
            prefs.edit().putInt("mf_widget_style", style).apply();
            
            // Forza il ridisegno immediato di TUTTI i widget
            Intent updateIntent = new Intent("com.martucc.fuel.UPDATE_WIDGET");
            updateIntent.setPackage(context.getPackageName());
            context.sendBroadcast(updateIntent);
        }
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.martucc_fuel_map_widget);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        
        // 1. Applica lo stile dello sfondo ciclico (specifico per widget o globale come fallback)
        int style = prefs.getInt("mf_widget_style_" + appWidgetId, prefs.getInt("mf_widget_style", 0));
        int bgDrawable = R.drawable.widget_background; // OLED scuro
        if (style == 1) {
            bgDrawable = R.drawable.widget_background_semi; // Glassmorphism
        } else if (style == 2) {
            bgDrawable = R.drawable.widget_background_transparent; // Trasparente
        }
        views.setInt(R.id.widget_map_root, "setBackgroundResource", bgDrawable);

        // 2. Sincronizzazione automatica se i dati sono più vecchi di 4 ore
        String lastFetchStr = prefs.getString("mf_last_fetch_time", "0");
        long lastFetch = Long.parseLong(lastFetchStr);
        if (lastFetch == 0 || (System.currentTimeMillis() - lastFetch > 4 * 60 * 60 * 1000)) {
            Log.d(TAG, "Prezzi vecchi di 4 ore rilevati dal Widget Mappa. Avvio sync in background.");
            FuelDataSyncManager.sync(context);
        }

        // 3. Estrai e visualizza i distributori nella lista a destra
        String stationsJson = prefs.getString("mf_widget_nearby_stations", "[]");
        List<NearbyStation> stationsList = new ArrayList<>();
        
        try {
            JSONArray arr = new JSONArray(stationsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject s = arr.getJSONObject(i);
                stationsList.add(new NearbyStation(
                    s.getString("id"),
                    s.getString("name"),
                    s.getDouble("lat"),
                    s.getDouble("lng"),
                    s.getDouble("distance"),
                    s.getDouble("price")
                ));
            }
        } catch (Exception e) {
            Log.e(TAG, "Errore parsing stazioni vicine", e);
        }

        // Popola la colonna destra (fino a 3 distributori)
        if (stationsList.size() > 0) {
            NearbyStation s1 = stationsList.get(0);
            views.setTextViewText(R.id.widget_map_s1_name, String.format(java.util.Locale.ITALIAN, "%s (%.1fkm)", s1.name, s1.distance));
            views.setTextViewText(R.id.widget_map_s1_price, String.format(java.util.Locale.ITALIAN, "%.3f", s1.price));
        } else {
            views.setTextViewText(R.id.widget_map_s1_name, "Apri l'app...");
            views.setTextViewText(R.id.widget_map_s1_price, "---");
        }

        if (stationsList.size() > 1) {
            NearbyStation s2 = stationsList.get(1);
            views.setTextViewText(R.id.widget_map_s2_name, String.format(java.util.Locale.ITALIAN, "%s (%.1fkm)", s2.name, s2.distance));
            views.setTextViewText(R.id.widget_map_s2_price, String.format(java.util.Locale.ITALIAN, "%.3f", s2.price));
        } else {
            views.setTextViewText(R.id.widget_map_s2_name, "");
            views.setTextViewText(R.id.widget_map_s2_price, "");
        }

        if (stationsList.size() > 2) {
            NearbyStation s3 = stationsList.get(2);
            views.setTextViewText(R.id.widget_map_s3_name, String.format(java.util.Locale.ITALIAN, "%s (%.1fkm)", s3.name, s3.distance));
            views.setTextViewText(R.id.widget_map_s3_price, String.format(java.util.Locale.ITALIAN, "%.3f", s3.price));
        } else {
            views.setTextViewText(R.id.widget_map_s3_name, "");
            views.setTextViewText(R.id.widget_map_s3_price, "");
        }

        // 4. Dipinge il Radar su un Canvas 2D
        Bitmap bitmap = drawRadarBitmap(context, stationsList, prefs, style);
        if (bitmap != null) {
            views.setImageViewBitmap(R.id.widget_radar_image, bitmap);
        }

        // 5. Imposta le azioni al click
        
        // Cliccare la colonna destra o il centro apre l'app
        Intent appIntent = context.getPackageManager().getLaunchIntentForPackage("com.martucc.fuel");
        if (appIntent == null) {
            appIntent = new Intent(context, MainActivity.class);
        }
        PendingIntent appPI = PendingIntent.getActivity(
                context, 20, appIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_map_list_layout, appPI);
        views.setOnClickPendingIntent(R.id.widget_radar_image, appPI);

        // Cliccare il pulsante "🎨" per cambiare lo stile visivo
        Intent styleIntent = new Intent("com.martucc.fuel.TOGGLE_STYLE");
        styleIntent.setPackage(context.getPackageName());
        PendingIntent stylePI = PendingIntent.getBroadcast(
                context, 21, styleIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_map_style_btn, stylePI);

        // Notifica l'avvenuto aggiornamento del widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private Bitmap drawRadarBitmap(Context context, List<NearbyStation> stations, SharedPreferences prefs, int style) {
        int width = 250;
        int height = 250;
        
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        
        // Pulisce sfondo trasparente
        canvas.drawColor(Color.TRANSPARENT);

        // A. Disegna lo sfondo della mappa cartografica reale se disponibile
        java.io.File mapFile = new java.io.File(context.getCacheDir(), "static_map.png");
        if (mapFile.exists()) {
            try {
                Bitmap mapBitmap = android.graphics.BitmapFactory.decodeFile(mapFile.getAbsolutePath());
                if (mapBitmap != null) {
                    android.graphics.Rect src = new android.graphics.Rect(0, 0, mapBitmap.getWidth(), mapBitmap.getHeight());
                    android.graphics.Rect dst = new android.graphics.Rect(0, 0, width, height);
                    canvas.drawBitmap(mapBitmap, src, dst, null);

                    // Applica una velatura semitrasparente sopra la mappa a seconda dello stile per garantire leggibilità neon premium
                    Paint overlayPaint = new Paint();
                    overlayPaint.setStyle(Paint.Style.FILL);
                    if (style == 0) {
                        // OLED: Sovrapponi colore nero con alta opacità (85%) per far risaltare il radar neon e la mappa sottostante
                        overlayPaint.setColor(Color.parseColor("#D5050607")); // OLED background `#050607` con opacità
                    } else if (style == 1) {
                        // Glassmorphism: Sovrapponi colore grigio-scuro semitrasparente (75%)
                        overlayPaint.setColor(Color.parseColor("#BF101524")); // Semitrasparente scuro
                    } else {
                        // Trasparente: Sovrapponi leggero scorrimento/velatura trasparente (60%)
                        overlayPaint.setColor(Color.parseColor("#99000000")); // Mappa visibile ma scura
                    }
                    canvas.drawRect(dst, overlayPaint);
                }
            } catch (Exception ex) {
                Log.e(TAG, "Errore nel disegno della tessera mappa su Canvas", ex);
            }
        }

        float centerX = width / 2f;
        float centerY = height / 2f;
        float maxRadius = Math.min(width, height) / 2f - 10;

        // Vernici per il Radar
        Paint gridPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        gridPaint.setColor(Color.parseColor("#1E293B")); // Scuro di fondo
        gridPaint.setStyle(Paint.Style.STROKE);
        gridPaint.setStrokeWidth(1.5f);

        Paint sweepPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        sweepPaint.setColor(Color.parseColor("#3B82F6")); // Neon Blue principale
        sweepPaint.setStyle(Paint.Style.STROKE);
        sweepPaint.setStrokeWidth(1.2f);

        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.parseColor("#94A3B8"));
        textPaint.setTextSize(9f);
        textPaint.setTextAlign(Paint.Align.CENTER);

        Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        dotPaint.setStyle(Paint.Style.FILL);

        Paint textBgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textBgPaint.setColor(Color.parseColor("#E0000000")); // Sfondo nero per le scritte
        textBgPaint.setStyle(Paint.Style.FILL);

        // A. Disegna la griglia di base (Cerchi Concentrici)
        canvas.drawCircle(centerX, centerY, maxRadius, gridPaint);
        canvas.drawCircle(centerX, centerY, maxRadius * 0.66f, gridPaint);
        canvas.drawCircle(centerX, centerY, maxRadius * 0.33f, gridPaint);

        // B. Disegna le rette a raggiera (mirino) tratteggiate
        Paint dashedPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        dashedPaint.setColor(Color.parseColor("#222A3C"));
        dashedPaint.setStyle(Paint.Style.STROKE);
        dashedPaint.setStrokeWidth(1f);
        dashedPaint.setPathEffect(new DashPathEffect(new float[]{6, 6}, 0));
        
        canvas.drawLine(centerX - maxRadius, centerY, centerX + maxRadius, centerY, dashedPaint);
        canvas.drawLine(centerX, centerY - maxRadius, centerX, centerY + maxRadius, dashedPaint);

        // C. Calcola la scala dinamica in base alle distanze delle stazioni presenti
        double maxDist = 5.0; // raggio minimo di 5km
        for (NearbyStation s : stations) {
            if (s.distance > maxDist) maxDist = s.distance;
        }
        double radarRange = maxDist * 1.15; // 15% di margine extra per non toccare i bordi

        // Scrive la scala del radar sul bordo in alto
        textPaint.setColor(Color.parseColor("#64748B"));
        canvas.drawText(String.format(java.util.Locale.ITALIAN, "%.1f km", radarRange), centerX, centerY - maxRadius + 14, textPaint);

        // D. Disegna la posizione dell'utente al centro (cerchietto blu neon pulsante)
        dotPaint.setColor(Color.parseColor("#3B82F6"));
        canvas.drawCircle(centerX, centerY, 5.5f, dotPaint);
        
        Paint glowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        glowPaint.setColor(Color.parseColor("#3B82F6"));
        glowPaint.setStyle(Paint.Style.STROKE);
        glowPaint.setStrokeWidth(1f);
        glowPaint.setAlpha(80);
        canvas.drawCircle(centerX, centerY, 10f, glowPaint);

        // E. Posiziona e disegna le stazioni
        if (stations.isEmpty()) {
            textPaint.setColor(Color.parseColor("#94A3B8"));
            textPaint.setTextSize(10f);
            canvas.drawText("Nessun radar", centerX, centerY + 20, textPaint);
            return bitmap;
        }

        // Calcola il prezzo minimo e medio per colorare i punti
        double minPrice = Double.MAX_VALUE;
        double avgPrice = 0;
        for (NearbyStation s : stations) {
            if (s.price < minPrice) minPrice = s.price;
            avgPrice += s.price;
        }
        avgPrice = stations.isEmpty() ? 0 : avgPrice / stations.size();

        // Recupera le coordinate GPS dell'utente per calcolare angoli e bearing reali
        String latStr = prefs.getString("mf_widget_user_lat", "45.4642");
        String lngStr = prefs.getString("mf_widget_user_lng", "9.19");
        double userLat = Double.parseDouble(latStr);
        double userLng = Double.parseDouble(lngStr);

        for (NearbyStation s : stations) {
            // Calcola la posizione cartesiana relativa in chilometri (dx, dy)
            double deltaLat = s.lat - userLat;
            double deltaLng = s.lng - userLng;
            
            double dy = deltaLat * 111.0;
            double dx = deltaLng * 111.0 * Math.cos(Math.toRadians(userLat));

            // Trasforma in coordinate pixel sul canvas (normalizzato sul radarRange)
            float px = centerX + (float) (dx / radarRange) * maxRadius;
            float py = centerY - (float) (dy / radarRange) * maxRadius; // y invertito nel canvas

            // Colora il punto in base al prezzo rispetto alla media della zona
            int color = Color.parseColor("#EAB308"); // Ambra default (prezzo medio)
            if (s.price <= minPrice) {
                color = Color.parseColor("#22C55E"); // Verde neon (più conveniente)
            } else if (s.price < avgPrice - 0.015) {
                color = Color.parseColor("#10B981"); // Smeraldo conveniente
            } else if (s.price > avgPrice + 0.015) {
                color = Color.parseColor("#EF4444"); // Rosso neon (caro)
            }

            // Disegna il punto
            dotPaint.setColor(color);
            canvas.drawCircle(px, py, 5f, dotPaint);

            // Disegna un cerchio di aurea attorno per visibilità premium
            Paint dotGlow = new Paint(Paint.ANTI_ALIAS_FLAG);
            dotGlow.setColor(color);
            dotGlow.setStyle(Paint.Style.STROKE);
            dotGlow.setStrokeWidth(0.8f);
            dotGlow.setAlpha(90);
            canvas.drawCircle(px, py, 9f, dotGlow);

            // Scrive il prezzo sopra il punto (es: "1.72")
            String priceLabel = String.format(java.util.Locale.ITALIAN, "%.2f", s.price);
            Paint labelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            labelPaint.setColor(Color.WHITE);
            labelPaint.setTextSize(8f);
            labelPaint.setTextAlign(Paint.Align.CENTER);
            labelPaint.setFakeBoldText(true);

            // Disegna un mini sfondo scuro per l'etichetta del prezzo
            float textWidth = labelPaint.measureText(priceLabel);
            float textHeight = 7f;
            RectF bgRect = new RectF(px - textWidth / 2f - 2, py - 16, px + textWidth / 2f + 2, py - 16 + textHeight + 2);
            canvas.drawRoundRect(bgRect, 2, 2, textBgPaint);

            canvas.drawText(priceLabel, px, py - 10f, labelPaint);
        }

        return bitmap;
    }

    private static class NearbyStation {
        String id;
        String name;
        double lat;
        double lng;
        double distance;
        double price;

        NearbyStation(String id, String name, double lat, double lng, double distance, double price) {
            this.id = id;
            this.name = name;
            this.lat = lat;
            this.lng = lng;
            this.distance = distance;
            this.price = price;
        }
    }
}
