package com.martucc.fuel;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.RadioGroup;

public class MartuccWidgetConfigureActivity extends Activity {
    private static final String PREFS_NAME = "CapacitorStorage";
    
    private int mAppWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    
    private RadioGroup mStyleGroup;
    private RadioGroup mFuelGroup;
    private Button mSaveBtn;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Imposta il risultato di default come ANNULLATO in caso l'utente esca premendo indietro
        setResult(RESULT_CANCELED);
        
        setContentView(R.layout.widget_configure);
        
        // Trova l'ID del widget dall'intent
        Intent intent = getIntent();
        Bundle extras = intent.getExtras();
        if (extras != null) {
            mAppWidgetId = extras.getInt(
                    AppWidgetManager.EXTRA_APPWIDGET_ID,
                    AppWidgetManager.INVALID_APPWIDGET_ID);
        }
        
        // Se l'ID del widget non è valido, chiudi l'attività
        if (mAppWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }
        
        mStyleGroup = findViewById(R.id.config_style_group);
        mFuelGroup = findViewById(R.id.config_fuel_group);
        mSaveBtn = findViewById(R.id.config_save_btn);
        
        // Carica le impostazioni correnti (globali o specifiche)
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        
        int currentStyle = prefs.getInt("mf_widget_style_" + mAppWidgetId, prefs.getInt("mf_widget_style", 0));
        if (currentStyle == 0) {
            mStyleGroup.check(R.id.radio_style_oled);
        } else if (currentStyle == 1) {
            mStyleGroup.check(R.id.radio_style_glass);
        } else if (currentStyle == 2) {
            mStyleGroup.check(R.id.radio_style_transparent);
        }
        
        String currentFuel = prefs.getString("mf_widget_fuel_type_" + mAppWidgetId, prefs.getString("mf_widget_fuel_type", "Benzina"));
        if ("Benzina".equalsIgnoreCase(currentFuel)) {
            mFuelGroup.check(R.id.radio_fuel_benzina);
        } else if ("Diesel".equalsIgnoreCase(currentFuel)) {
            mFuelGroup.check(R.id.radio_fuel_diesel);
        } else if ("GPL".equalsIgnoreCase(currentFuel)) {
            mFuelGroup.check(R.id.radio_fuel_gpl);
        } else if ("Metano".equalsIgnoreCase(currentFuel)) {
            mFuelGroup.check(R.id.radio_fuel_metano);
        }
        
        mSaveBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                saveSettingsAndFinish();
            }
        });
    }
    
    private void saveSettingsAndFinish() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        
        // 1. Determina lo stile scelto
        int selectedStyle = 0;
        int checkedStyleId = mStyleGroup.getCheckedRadioButtonId();
        if (checkedStyleId == R.id.radio_style_oled) {
            selectedStyle = 0;
        } else if (checkedStyleId == R.id.radio_style_glass) {
            selectedStyle = 1;
        } else if (checkedStyleId == R.id.radio_style_transparent) {
            selectedStyle = 2;
        }
        
        // Salva lo stile sia specifico per il widget che globale
        editor.putInt("mf_widget_style_" + mAppWidgetId, selectedStyle);
        editor.putInt("mf_widget_style", selectedStyle);
        
        // 2. Determina il carburante scelto
        String selectedFuel = "Benzina";
        int checkedFuelId = mFuelGroup.getCheckedRadioButtonId();
        if (checkedFuelId == R.id.radio_fuel_benzina) {
            selectedFuel = "Benzina";
        } else if (checkedFuelId == R.id.radio_fuel_diesel) {
            selectedFuel = "Diesel";
        } else if (checkedFuelId == R.id.radio_fuel_gpl) {
            selectedFuel = "GPL";
        } else if (checkedFuelId == R.id.radio_fuel_metano) {
            selectedFuel = "Metano";
        }
        
        // Salva il carburante sia specifico per il widget che globale
        editor.putString("mf_widget_fuel_type_" + mAppWidgetId, selectedFuel);
        editor.putString("mf_widget_fuel_type", selectedFuel);
        
        editor.apply();
        
        // 3. Esegui subito una sincronizzazione per scaricare i prezzi aggiornati per il carburante scelto
        Context context = getApplicationContext();
        FuelDataSyncManager.sync(context);
        
        // Invia broadcast di aggiornamento
        Intent updateIntent = new Intent("com.martucc.fuel.UPDATE_WIDGET");
        updateIntent.setPackage(context.getPackageName());
        context.sendBroadcast(updateIntent);
        
        // Rispondi con successo al sistema Android
        Intent resultValue = new Intent();
        resultValue.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, mAppWidgetId);
        setResult(RESULT_OK, resultValue);
        finish();
    }
}
