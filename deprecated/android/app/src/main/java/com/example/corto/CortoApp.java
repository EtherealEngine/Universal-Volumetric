package com.example.corto;

import android.app.Application;

import timber.log.Timber;

public class CortoApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        Timber.plant(new Timber.DebugTree());
    }
}
