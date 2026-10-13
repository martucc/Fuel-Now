package com.martucc.fuel;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Notte, dipinto sulla schermata home.
 *
 * Un solo posto disegna tutti i widget: se il Tabellone e la Tacca avessero
 * ciascuno il proprio codice finirebbero per dire due cose diverse dello
 * stesso prezzo, ed e esattamente il difetto che questo lavoro toglie.
 *
 * Il widget non calcola niente. Le stringhe le compone chi sa l'italiano e
 * conosce il dominio - l'app in TypeScript, o FuelDataSyncManager quando
 * l'app e chiusa da ore - e qui si limitano a essere messe in pagina.
 */
final class MfNotte {

    static final String DEPOSITO = "CapacitorStorage";

    /** Le chiavi del patto con il web. Cambiarle qui e in src/services/widget.ts. */
    static final String K_PREZZO = "mf_w_prezzo";
    static final String K_LIVELLO = "mf_w_livello";
    static final String K_DOVE = "mf_w_dove";
    static final String K_SCARTO = "mf_w_scarto";
    static final String K_VERDETTO = "mf_w_verdetto";
    static final String K_CONTESTO = "mf_w_contesto";
    static final String K_ETA = "mf_w_eta";
    static final String K_LAT = "mf_w_lat";
    static final String K_LNG = "mf_w_lng";
    static final String K_SCRITTO = "mf_w_scritto";
    /** «casa» quando la Home ragiona sul rientro, «zona» altrimenti. */
    static final String K_MODO = "mf_w_modo";
    static final String K_CASA_LAT = "mf_w_casa_lat";
    static final String K_CASA_LNG = "mf_w_casa_lng";
    /** Il widget in una frase, per TalkBack. */
    static final String K_VOCE = "mf_w_voce";

    /** Oltre questa soglia il widget smette di spacciare per fresco cio che non lo e. */
    private static final long VECCHIAIA_MS = 8L * 60L * 60L * 1000L;

    private MfNotte() {}

    static SharedPreferences deposito(Context ctx) {
        return ctx.getSharedPreferences(DEPOSITO, Context.MODE_PRIVATE);
    }

    /**
     * Dipinge una vista. Gli id sono gli stessi nei due impaginati, quindi
     * questo metodo li serve entrambi; conPortami distingue il Tabellone,
     * l'unico che ha spazio per il pulsante.
     */
    static void dipingi(Context ctx, RemoteViews v, int appWidgetId, boolean conPortami) {
        SharedPreferences p = deposito(ctx);

        v.setInt(R.id.mf_radice, "setBackgroundResource", sfondo(p, appWidgetId));

        // I prezzi vecchi di ore non vanno mostrati come se fossero di adesso.
        long scritto = leggiLong(p, K_SCRITTO);
        boolean stantio = scritto > 0 && (System.currentTimeMillis() - scritto) > VECCHIAIA_MS;
        boolean vuoto = p.getString(K_PREZZO, "").isEmpty();

        String livello = p.getString(K_LIVELLO, "");
        int coloreP = vuoto || stantio ? colore(ctx, R.color.mf_muted) : coloreLivello(ctx, livello);

        v.setTextViewText(R.id.mf_prezzo, vuoto ? "—" : p.getString(K_PREZZO, "—"));
        v.setTextColor(R.id.mf_prezzo, coloreP);

        v.setTextViewText(R.id.mf_dove, p.getString(K_DOVE, "Apri l’app"));
        v.setTextViewText(R.id.mf_scarto, maiuscolo(p.getString(K_SCARTO, "")));
        v.setTextViewText(R.id.mf_contesto, maiuscolo(p.getString(K_CONTESTO, "")));
        v.setTextViewText(R.id.mf_eta, p.getString(K_ETA, ""));

        accendiIstogramma(ctx, v, vuoto || stantio ? -1 : indice(livello), coloreP);

        // Il verdetto e l'ultima riga che uno legge: se i dati sono vecchi,
        // dire "Fai il pieno" sarebbe un consiglio dato al buio.
        if (stantio) {
            v.setTextViewText(R.id.mf_verdetto, "DA AGGIORNARE");
            v.setTextColor(R.id.mf_verdetto, colore(ctx, R.color.mf_price_high));
        } else if (vuoto) {
            v.setTextViewText(R.id.mf_verdetto, "APRI L’APP");
            v.setTextColor(R.id.mf_verdetto, colore(ctx, R.color.mf_ink_2));
        } else {
            v.setTextViewText(R.id.mf_verdetto, maiuscolo(p.getString(K_VERDETTO, "")));
            v.setTextColor(R.id.mf_verdetto, colore(ctx, R.color.mf_accent));
        }

        // Letto ad alta voce il widget e una fila di numeri senza sintassi:
        // «trattino, uno virgola nove due nove». La frase la compone l'app,
        // che sa l'italiano; qui si attacca alla radice.
        String voce = p.getString(K_VOCE, "");
        if (!voce.isEmpty() && !stantio) {
            v.setContentDescription(R.id.mf_radice, voce);
        } else if (stantio) {
            v.setContentDescription(R.id.mf_radice,
                    "Martucc Fuel: prezzi da aggiornare. Tocca per aprire l’app.");
        } else {
            v.setContentDescription(R.id.mf_radice,
                    "Martucc Fuel: nessun prezzo ancora. Tocca per aprire l’app.");
        }

        v.setOnClickPendingIntent(R.id.mf_radice, apriApp(ctx));
        v.setOnClickPendingIntent(R.id.mf_istogramma, cambiaSfondo(ctx, appWidgetId));
        if (conPortami) {
            boolean incerto = stantio || vuoto;
            boolean rientro = "casa".equals(p.getString(K_MODO, "zona"));
            // Passando di li non ti «porto li»: ci passi e tiri dritto verso
            // casa. Dirlo cambia cosa uno si aspetta quando tocca.
            v.setTextViewText(R.id.mf_portami,
                    rientro && !incerto ? "PASSA DI LÌ  ›" : "PORTAMI LÌ  ›");
            v.setOnClickPendingIntent(R.id.mf_portami, portamiLi(ctx, p, incerto));
            v.setTextColor(R.id.mf_portami,
                    colore(ctx, incerto ? R.color.mf_muted : R.color.mf_accent));
        }
    }

    /**
     * L'istogramma dell'icona fa da scala del prezzo: accesa solo la tacca
     * del livello, le altre spente. E lo stesso segno che si vede sul
     * lanciatore, quindi il widget si riconosce prima di leggerlo.
     */
    private static void accendiIstogramma(Context ctx, RemoteViews v, int acceso, int coloreAcceso) {
        int[] tacche = { R.id.mf_tacca_1, R.id.mf_tacca_2, R.id.mf_tacca_3,
                         R.id.mf_tacca_4, R.id.mf_tacca_5 };
        int spento = colore(ctx, R.color.mf_tacca_spenta);
        for (int i = 0; i < tacche.length; i++) {
            v.setInt(tacche[i], "setColorFilter", i == acceso ? coloreAcceso : spento);
        }
    }

    private static int indice(String livello) {
        switch (livello) {
            case "best":   return 0;
            case "good":   return 1;
            case "normal": return 2;
            case "high":   return 3;
            case "worst":  return 4;
            default:       return -1;
        }
    }

    private static int coloreLivello(Context ctx, String livello) {
        switch (livello) {
            case "best":   return colore(ctx, R.color.mf_price_best);
            case "good":   return colore(ctx, R.color.mf_price_good);
            case "normal": return colore(ctx, R.color.mf_price_normal);
            case "high":   return colore(ctx, R.color.mf_price_high);
            case "worst":  return colore(ctx, R.color.mf_price_worst);
            default:       return colore(ctx, R.color.mf_ink);
        }
    }

    @SuppressWarnings("deprecation")
    private static int colore(Context ctx, int id) {
        return ctx.getResources().getColor(id);
    }

    private static String maiuscolo(String s) {
        return s == null ? "" : s.toUpperCase(java.util.Locale.ITALIAN);
    }

    private static long leggiLong(SharedPreferences p, String k) {
        // Capacitor Preferences scrive sempre stringhe, anche per i numeri.
        try {
            return Long.parseLong(p.getString(k, "0"));
        } catch (Exception e) {
            return 0L;
        }
    }

    // ---- sfondi ----

    static int sfondo(SharedPreferences p, int appWidgetId) {
        int stile = p.getInt("mf_widget_style_" + appWidgetId, p.getInt("mf_widget_style", 0));
        if (stile == 1) return R.drawable.mf_sfondo_velato;
        if (stile == 2) return R.drawable.mf_sfondo_nudo;
        return R.drawable.mf_sfondo_pieno;
    }

    /** Ruota lo sfondo del solo widget toccato: due widget, due sfondi. */
    static void ruotaSfondo(Context ctx, int appWidgetId) {
        SharedPreferences p = deposito(ctx);
        String k = "mf_widget_style_" + appWidgetId;
        p.edit().putInt(k, (p.getInt(k, p.getInt("mf_widget_style", 0)) + 1) % 3).apply();
    }

    // ---- intenti ----

    private static PendingIntent apriApp(Context ctx) {
        Intent i = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (i == null) i = new Intent(ctx, MainActivity.class);
        return PendingIntent.getActivity(ctx, 1, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Lo stesso indirizzo che apre il tasto dentro l'app.
     *
     * In rientro la destinazione e casa e la pompa e una tappa: mandare a
     * destinazione la pompa vorrebbe dire far finire il navigatore li,
     * proprio nel caso in cui l'utente sta andando da un'altra parte.
     */
    private static PendingIntent portamiLi(Context ctx, SharedPreferences p, boolean incerto) {
        String lat = p.getString(K_LAT, "");
        String lng = p.getString(K_LNG, "");
        if (incerto || lat.isEmpty() || lng.isEmpty()) return apriApp(ctx);

        String casaLat = p.getString(K_CASA_LAT, "");
        String casaLng = p.getString(K_CASA_LNG, "");
        boolean rientro = "casa".equals(p.getString(K_MODO, "zona"))
                && !casaLat.isEmpty() && !casaLng.isEmpty();

        String url = rientro
                ? "https://www.google.com/maps/dir/?api=1&destination=" + casaLat + "," + casaLng
                        + "&waypoints=" + lat + "," + lng
                : "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng;

        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(ctx, 2, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent cambiaSfondo(Context ctx, int appWidgetId) {
        Intent i = new Intent(MartuccFuelWidgetProvider.AZIONE_SFONDO);
        i.setPackage(ctx.getPackageName());
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        return PendingIntent.getBroadcast(ctx, 3000 + appWidgetId, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---- freschezza ----

    /** Se i prezzi in mano hanno piu di quattro ore, li richiede da qui. */
    static void sincronizzaSeVecchio(Context ctx) {
        long ultimo = leggiLong(deposito(ctx), "mf_last_fetch_time");
        if (ultimo == 0 || System.currentTimeMillis() - ultimo > 4L * 60L * 60L * 1000L) {
            FuelDataSyncManager.sync(ctx);
        }
    }
}
