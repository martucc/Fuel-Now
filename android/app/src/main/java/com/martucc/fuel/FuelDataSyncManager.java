package com.martucc.fuel;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class FuelDataSyncManager {
    private static final String TAG = "FuelDataSync";
    private static final String GITHUB_URL = "https://raw.githubusercontent.com/martucc/Fuel-Now/main/public/stations.json";
    private static final String PREFS_NAME = "CapacitorStorage";
    
    private static boolean isSyncing = false;
    private static long lastSyncTime = 0;

    public static synchronized void sync(final Context context) {
        // Impedisci sync paralleli o troppo ravvicinati (minimo 5 minuti tra i sync nativi)
        long now = System.currentTimeMillis();
        if (isSyncing || (now - lastSyncTime < 5 * 60 * 1000)) {
            Log.d(TAG, "Sync già in corso o eseguito di recente. Salto.");
            return;
        }

        isSyncing = true;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "Inizio sync nativo dei dati...");
                    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                    
                    // Recupera l'ultima posizione nota salvata dall'app JS
                    String latStr = prefs.getString("mf_widget_user_lat", "45.4642");
                    String lngStr = prefs.getString("mf_widget_user_lng", "9.19");
                    double userLat = Double.parseDouble(latStr);
                    double userLng = Double.parseDouble(lngStr);
                    
                    // Scarica la tessera mappa in background basata su coordinate reali
                    try {
                        String zoomStr = prefs.getString("mf_widget_map_zoom", "14");
                        int zoom = 14;
                        try {
                            zoom = Integer.parseInt(zoomStr);
                            if (zoom < 10 || zoom > 18) zoom = 14;
                        } catch (Exception e) {
                            Log.e(TAG, "Formato zoom non valido nelle preferenze, ripiego su 14", e);
                        }

                        int xtile = (int) Math.floor((userLng + 180) / 360 * (1 << zoom));
                        double latRad = Math.toRadians(userLat);
                        int ytile = (int) Math.floor((1 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2 * (1 << zoom));
                        String tileUrl = "https://basemaps.cartocdn.com/rastertiles/voyager/" + zoom + "/" + xtile + "/" + ytile + ".png";
                        java.io.File mapFile = new java.io.File(context.getCacheDir(), "static_map.png");
                        Log.d(TAG, "Download mappa statica con zoom " + zoom + " da: " + tileUrl);
                        downloadBinaryFile(tileUrl, mapFile);
                    } catch (Exception ex) {
                        Log.e(TAG, "Errore nel download della mappa", ex);
                    }

                    // Recupera il tipo di carburante preferito
                    String fuelType = prefs.getString("mf_widget_fuel_type", "Benzina");
                    String fuelKey = fuelType.toLowerCase();

                    // 1. Fetch stations.json da GitHub
                    String jsonStr = fetchUrl(GITHUB_URL);
                    if (jsonStr != null && jsonStr.length() > 0) {
                        JSONObject root = new JSONObject(jsonStr);
                        if (root.has("stations")) {
                            JSONArray stationsArr = root.getJSONArray("stations");
                            
                            List<StationData> localStations = new ArrayList<>();
                            
                            // Carica le stazioni bloccate dalla community o dall'utente
                            String blockedStr = prefs.getString("mf_blocked", "[]");
                            List<String> blockedIds = new ArrayList<>();
                            try {
                                JSONArray bArr = new JSONArray(blockedStr);
                                for (int i = 0; i < bArr.length(); i++) {
                                    blockedIds.add(bArr.getString(i));
                                }
                            } catch (Exception e) {
                                Log.e(TAG, "Errore caricamento stazioni bloccate", e);
                            }

                            for (int i = 0; i < stationsArr.length(); i++) {
                                JSONObject sObj = stationsArr.getJSONObject(i);
                                String id = String.valueOf(sObj.optInt("id", sObj.optInt("id")));
                                
                                if (blockedIds.contains(id)) continue;

                                String name = sObj.optString("name", "Indipendente");
                                String brand = sObj.optString("brand", "Indipendente");
                                double lat = sObj.optDouble("lat", 0);
                                double lng = sObj.optDouble("lng", 0);
                                
                                if (lat == 0 || lng == 0) continue;

                                double distance = calculateDistance(userLat, userLng, lat, lng);
                                
                                // Estrai il prezzo per il carburante selezionato
                                double price = -1;
                                if (sObj.has("p")) {
                                    JSONObject pObj = sObj.getJSONObject("p");
                                    if (pObj.has(fuelKey)) {
                                        JSONArray pArr = pObj.getJSONArray(fuelKey);
                                        if (pArr.length() > 0 && !pArr.isNull(0)) {
                                            price = pArr.getDouble(0);
                                        }
                                    }
                                }

                                if (price > 0 && price < 3.0) { // prezzi validi realistici
                                    localStations.add(new StationData(id, name, brand, lat, lng, distance, price));
                                }
                            }

                            // Calcola il più economico ed il più vicino entro 20km
                            StationData cheapest = null;
                            StationData closest = null;
                            double minPrice = Double.MAX_VALUE;
                            double minDistance = Double.MAX_VALUE;

                            // Filtra entro 20km (o 40km fallback)
                            List<StationData> filteredStations = new ArrayList<>();
                            for (StationData s : localStations) {
                                if (s.distance <= 20.0) {
                                    filteredStations.add(s);
                                }
                            }
                            if (filteredStations.isEmpty()) {
                                for (StationData s : localStations) {
                                    if (s.distance <= 40.0) {
                                        filteredStations.add(s);
                                    }
                                }
                            }
                            if (filteredStations.isEmpty()) {
                                filteredStations = localStations;
                            }

                            for (StationData s : filteredStations) {
                                if (s.price < minPrice) {
                                    minPrice = s.price;
                                    cheapest = s;
                                }
                                if (s.distance < minDistance) {
                                    minDistance = s.distance;
                                    closest = s;
                                }
                            }

                            SharedPreferences.Editor editor = prefs.edit();

                            // Le stesse chiavi che scrive l'app, cosi il widget non deve
                            // sapere chi lo ha rifornito. Ma qui non ci sono le coorti di
                            // provincia ne il costo del viaggio: senza quelli il livello
                            // non si puo dichiarare, e infatti resta vuoto - il prezzo esce
                            // bianco e le tacche spente. Meglio non dire niente che dare
                            // un giudizio che non si e in grado di dare.
                            if (cheapest != null) {
                                String marca = !cheapest.brand.equals("Indipendente") ? cheapest.brand : cheapest.name;
                                editor.putString(MfNotte.K_PREZZO,
                                        String.format(java.util.Locale.ITALIAN, "%.3f", cheapest.price));
                                editor.putString(MfNotte.K_LIVELLO, "");
                                editor.putString(MfNotte.K_DOVE, marca);
                                editor.putString(MfNotte.K_SCARTO, "Il piu basso qui intorno");
                                editor.putString(MfNotte.K_VERDETTO, "Apri per il consiglio");
                                editor.putString(MfNotte.K_CONTESTO, String.format(java.util.Locale.ITALIAN,
                                        "%s · %.1f km", nomeCarburante(fuelType), cheapest.distance));
                                editor.putString(MfNotte.K_ETA, "");
                                editor.putString(MfNotte.K_LAT, String.valueOf(cheapest.lat));
                                editor.putString(MfNotte.K_LNG, String.valueOf(cheapest.lng));
                                editor.putString(MfNotte.K_SCRITTO, String.valueOf(System.currentTimeMillis()));

                                // Questo impianto e il piu basso qui intorno, non quello
                                // scelto pesando la deviazione verso casa. Se restasse
                                // scritto «casa» dall'ultima apertura dell'app, il tasto
                                // manderebbe il navigatore a passare da una pompa scelta
                                // con un altro criterio - proprio nel caso in cui l'utente
                                // sta andando da un'altra parte.
                                editor.putString(MfNotte.K_MODO, "zona");
                                editor.putString(MfNotte.K_CASA_LAT, "");
                                editor.putString(MfNotte.K_CASA_LNG, "");
                                editor.putString(MfNotte.K_VOCE, String.format(java.util.Locale.ITALIAN,
                                        "%s a %.3f euro al litro, %s, a %.1f chilometri da qui. "
                                                + "Apri l’app per il consiglio completo.",
                                        nomeCarburante(fuelType), cheapest.price, marca, cheapest.distance));
                            }

                            // Ordina le stazioni per distanza per il Radar Widget e salvale (top 5)
                            Collections.sort(filteredStations, new Comparator<StationData>() {
                                @Override
                                public int compare(StationData o1, StationData o2) {
                                    return Double.compare(o1.distance, o2.distance);
                                }
                            });
                            
                            JSONArray nearbyArr = new JSONArray();
                            int maxNearby = Math.min(5, filteredStations.size());
                            for (int k = 0; k < maxNearby; k++) {
                                StationData s = filteredStations.get(k);
                                JSONObject sJson = new JSONObject();
                                sJson.put("id", s.id);
                                sJson.put("name", !s.brand.equals("Indipendente") ? s.brand : s.name);
                                sJson.put("lat", s.lat);
                                sJson.put("lng", s.lng);
                                sJson.put("distance", s.distance);
                                sJson.put("price", s.price);
                                nearbyArr.put(sJson);
                            }
                            editor.putString("mf_widget_nearby_stations", nearbyArr.toString());
                            
                            editor.apply();
                            Log.d(TAG, "Prezzi dei carburanti sincronizzati con successo da remoto!");
                        }
                    }

                    // Registra l'avvenuto fetch nativo salvando il timestamp
                    prefs.edit().putString("mf_last_fetch_time", String.valueOf(System.currentTimeMillis())).apply();
                    lastSyncTime = System.currentTimeMillis();

                    // Spedisce l'intent di broadcast per forzare l'aggiornamento grafico immediato di tutti i widget
                    Intent updateIntent = new Intent(MartuccFuelWidgetProvider.AZIONE_AGGIORNA);
                    updateIntent.setPackage(context.getPackageName());
                    context.sendBroadcast(updateIntent);

                } catch (Exception e) {
                    Log.e(TAG, "Errore durante il sync asincrono in background", e);
                } finally {
                    isSyncing = false;
                }
            }
        }).start();
    }

    private static boolean downloadBinaryFile(String urlStr, java.io.File outputFile) {
        java.io.InputStream is = null;
        java.io.FileOutputStream os = null;
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setUseCaches(false);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; Mobile)");

            int responseCode = conn.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_OK) {
                is = conn.getInputStream();
                os = new java.io.FileOutputStream(outputFile);
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = is.read(buffer)) != -1) {
                    os.write(buffer, 0, bytesRead);
                }
                return true;
            } else {
                Log.e(TAG, "Mappa download fallito, response code: " + responseCode);
            }
        } catch (Exception e) {
            Log.e(TAG, "Errore download mappa", e);
        } finally {
            try { if (is != null) is.close(); } catch (Exception ignored) {}
            try { if (os != null) os.close(); } catch (Exception ignored) {}
            if (conn != null) conn.disconnect();
        }
        return false;
    }

    private static String fetchUrl(String urlStr) {
        StringBuilder result = new StringBuilder();
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setUseCaches(false);
            
            int responseCode = conn.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_OK) {
                BufferedReader rd = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                String line;
                while ((line = rd.readLine()) != null) {
                    result.append(line);
                }
                rd.close();
                return result.toString();
            }
        } catch (Exception e) {
            Log.e(TAG, "Errore connessione HTTP per: " + urlStr, e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
        return null;
    }

    private static double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371; // Raggio della Terra in km
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /** Come si chiama il carburante quando lo si scrive, non la sua chiave. */
    private static String nomeCarburante(String chiave) {
        if (chiave == null) return "";
        String c = chiave.toLowerCase(java.util.Locale.ITALIAN);
        if (c.startsWith("diesel") || c.startsWith("gasolio")) return "Diesel";
        if (c.startsWith("gpl")) return "GPL";
        if (c.startsWith("metano")) return "Metano";
        return "Benzina";
    }

    private static class StationData {
        String id;
        String name;
        String brand;
        double lat;
        double lng;
        double distance;
        double price;

        StationData(String id, String name, String brand, double lat, double lng, double distance, double price) {
            this.id = id;
            this.name = name;
            this.brand = brand;
            this.lat = lat;
            this.lng = lng;
            this.distance = distance;
            this.price = price;
        }
    }
}
