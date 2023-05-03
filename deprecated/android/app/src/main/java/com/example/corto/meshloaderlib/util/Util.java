package com.example.corto.meshloaderlib.util;

import android.content.Context;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class Util {

    public static String read(Context context, String filename){

        StringBuilder buf = new StringBuilder();
        InputStream text;
        BufferedReader in;
        String str;

        try {
            text = context.getAssets().open(filename);
            in = new BufferedReader(new InputStreamReader(text, StandardCharsets.UTF_8));
            while ( (str = in.readLine()) != null ) {
                str += '\n';
                buf.append(str);
            }
            in.close();

            return buf.toString();

        } catch (IOException e) {
            e.printStackTrace();
        }

        throw new RuntimeException("Error loading file "+filename+".");

    }

    public static int addToArray(float[] array, int pos, String... values){
        for (String value : values){
            array[pos++] = Float.parseFloat(value);
        }
        return pos;
    }

    public static int addToArray(int[] array, int pos, Integer... values){
        for (Integer value : values){
            array[pos++] = value;
        }
        return pos;
    }

    public static int addToArray(float[] array, int pos, float... values){
        for (float value : values){
            array[pos++] = value;
        }
        return pos;
    }

    public static int addToArray(int[] array, int pos, String... values){
        for (String value : values){
            array[pos++] = Integer.parseInt(value);
        }
        return pos;
    }

    public static Bitmap getBitmapFromAsset(Context context, String filename){
        AssetManager assetManager = context.getAssets();
        try {
            return rotate(BitmapFactory.decodeStream(assetManager.open(filename)));
        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }

    private static Bitmap rotate(Bitmap bitmap){
        Matrix matrix = new Matrix();
        matrix.postRotate(180);
        matrix.postScale(-1,1,bitmap.getWidth()/2f,bitmap.getHeight()/2f);
        return Bitmap.createBitmap(bitmap,0,0,bitmap.getWidth(),bitmap.getHeight(),matrix,true);
    }
}
