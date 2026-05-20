package com.martucc.fuel;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import java.util.Calendar;

public class MartuccAlarmScheduler {
    private static final String TAG = "MartuccAlarm";

    public static void scheduleAlarm(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            Log.e(TAG, "Impossibile ottenere l'AlarmManager di sistema.");
            return;
        }

        Intent intent = new Intent(context, DailySyncReceiver.class);
        intent.setAction("com.martucc.fuel.DAILY_ALARM");
        
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, 
            99, 
            intent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(System.currentTimeMillis());
        calendar.set(Calendar.HOUR_OF_DAY, 6);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);

        // Se le 6:00 di oggi sono già passate, pianifica per le 6:00 di domani
        if (calendar.getTimeInMillis() <= System.currentTimeMillis()) {
            calendar.add(Calendar.DAY_OF_YEAR, 1);
        }

        Log.d(TAG, "Allarme programmato per: " + calendar.getTime().toString());

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    calendar.getTimeInMillis(),
                    pendingIntent
                );
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    calendar.getTimeInMillis(),
                    pendingIntent
                );
            }
        } catch (Exception e) {
            Log.e(TAG, "Errore nella programmazione dell'allarme", e);
            // Fallback su allarme normale in caso di restrizioni di sicurezza
            alarmManager.set(
                AlarmManager.RTC_WAKEUP,
                calendar.getTimeInMillis(),
                pendingIntent
            );
        }
    }
}
