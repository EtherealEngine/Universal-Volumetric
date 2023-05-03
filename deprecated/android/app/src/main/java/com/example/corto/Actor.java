package com.example.corto;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.graphics.SurfaceTexture;
import android.media.MediaPlayer;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.opengl.Matrix;
import android.util.Log;
import android.view.Surface;

import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleObserver;
import androidx.lifecycle.OnLifecycleEvent;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;


import timber.log.Timber;

import static android.opengl.GLES11Ext.GL_TEXTURE_EXTERNAL_OES;

public class Actor implements SurfaceTexture.OnFrameAvailableListener,
        MediaPlayer.OnPreparedListener, MediaPlayer.OnErrorListener, LifecycleObserver {

    // Used to load the 'native-lib' library on application startup.
    static {
        System.loadLibrary("libcorto");
    }

    public Mesh mesh;
    public String manifestUrl;
    public int uvolId;
    int videoId;
    public SurfaceTexture surfaceTexture;
    public MediaPlayer mediaPlayer;
    private JSONArray frameData;
    private Context context;
    public boolean updateSurface;
    private FileInputStream uvolInputStream;
    private int currentUvolPosition = 0;

    public float[] mSTMatrix = new float[16];
    private int mTextureID;

    public boolean isPrepared = false;

    public float frameRate = 30;

    protected int currentFrame = 0;
    protected int lastFrame = -1;

    public void setCurrentFrameFromTime(){
        currentFrame = (int)Math.ceil((mediaPlayer.getCurrentPosition() * this.frameRate)/1000);
    }

    public void updateFrame()
    {
        synchronized(this)
        {
            if (updateSurface)
            {
                //Timber.d("updateFrame");
                setCurrentFrameFromTime();
                surfaceTexture.updateTexImage();
                surfaceTexture.getTransformMatrix(mSTMatrix);

                if (currentFrame != lastFrame) {
                    GetActorDataForFrame();
                    setLastFrameToCurrentFrame();
                }
                updateSurface = false;
            }
        }


    }
    public void setLastFrameToCurrentFrame(){
        lastFrame = currentFrame;
    }
    private void checkGlError(String op) {
        int error;
        while ((error = GLES20.glGetError()) != GLES20.GL_NO_ERROR) {
            Timber.e(op + ": glError " + error);
            throw new RuntimeException(op + ": glError " + error);
        }
    }
    public Actor(Context context, String manifestUrl, int uvolId, int videoId){
        this.manifestUrl = manifestUrl;
        this.uvolId = uvolId;
        this.videoId = videoId;

        this.context = context;
        this.mesh = null;

        LoadManifest();
        LoadUvol();
        LoadVideo();
        Matrix.setIdentityM(mSTMatrix, 0);
    }

    public void onSurfaceCreated()
    {
        Timber.d("onSurfaceCreated");
        currentFrame = 0;
        int[] textures = new int[1];
        GLES20.glGenTextures(1, textures, 0);
        mTextureID = textures[0];
        GLES20.glBindTexture(GL_TEXTURE_EXTERNAL_OES, mTextureID);

        Timber.d("mTextureID %d", mTextureID);
        checkGlError("glBindTexture mTextureID");

        GLES20.glTexParameterf(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER,
                GLES20.GL_NEAREST);
        GLES20.glTexParameterf(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER,
                GLES20.GL_LINEAR);

        surfaceTexture = new SurfaceTexture(mTextureID);
        surfaceTexture.setOnFrameAvailableListener(this);

        Surface surface = new Surface(surfaceTexture);
        mediaPlayer.setSurface(surface);
        mediaPlayer.setScreenOnWhilePlaying(true);
        surface.release();

        mediaPlayer.setLooping(true);
        mediaPlayer.setOnPreparedListener(this);

        try {
            mediaPlayer.prepareAsync();
        } catch (Exception t) {
            Timber.e("media player prepare failed "+t);
            t.printStackTrace();
        }

        synchronized(this) {
            updateSurface = false;
        }

    }
    public void LoadManifest(){
        Timber.d("LoadManifest");
        try {
            InputStream is = this.context.getAssets().open(this.manifestUrl);

            int size = is.available();

            byte[] buffer = new byte[size];

            is.read(buffer);

            is.close();
            JSONObject manifest = new JSONObject(new String(buffer, "UTF-8"));
            this.frameRate = manifest.getInt("frameRate");
            this.frameData = manifest.getJSONArray("frameData");
        } catch (IOException | JSONException ex) {
            ex.printStackTrace();
        }
    }

    public void LoadUvol(){
        // TODO: Open an input stream, set position to 0, and allocate input stream
        try {
            AssetFileDescriptor afd = context.getResources().openRawResourceFd(uvolId);
            uvolInputStream = afd.createInputStream();
            currentUvolPosition = 0;
           // afd.close();
        } catch (Exception e) {
            Timber.e("load uvol fail "+e);
            e.printStackTrace();
        }
    }

    public void LoadVideo(){

        mediaPlayer = new MediaPlayer();

        try {
            AssetFileDescriptor afd = context.getResources().openRawResourceFd(videoId);
            mediaPlayer.setDataSource(
                    afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
        } catch (Exception e) {
            Timber.e("open video fail "+e);
            e.printStackTrace();
        }
    }

    public void GetActorDataForFrame(){
        Timber.d("GetActorDataForFrame %d %d",currentFrame, mediaPlayer.getCurrentPosition());
        // TODO: Get start and end lengths from manifest
        try {

            JSONObject frameData = this.frameData.getJSONObject(this.currentFrame);

            int startBytePosition = frameData.getInt("startBytePosition");
            int length = frameData.getInt("meshLength");
//            int vertices = frameData.getInt("vertices");
//            int faces = frameData.getInt("faces");

            //Timber.d("startBytePosition %d currentpos %d", startBytePosition, currentUvolPosition);
            //Timber.d("lenth %d, available %d", length, uvolInputStream.available());

            long skip = 0;
            if(currentUvolPosition > startBytePosition){
                uvolInputStream.close();
                LoadUvol();
                skip = uvolInputStream.skip(startBytePosition);
           } else {
                skip = uvolInputStream.skip(startBytePosition - currentUvolPosition);
            }
            //Timber.d("skip %d", skip);


            byte[] bytes = new byte[length];
            uvolInputStream.read(bytes, 0, length);
            currentUvolPosition = startBytePosition+length;

            mesh = decode(bytes);
            mesh.init();
            mesh.setParameter(mTextureID, mSTMatrix);

        } catch (JSONException | IOException e) {
            Timber.e("GetActorDataForFrame "+e);
            e.printStackTrace();
        }
    }


    @Override
    public void onPrepared(MediaPlayer player) {
        Timber.d("onPrepared");
        isPrepared = true;
        Play();

    }


    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        return false;
    }

    public void Play(){
        Timber.d("Play");
        mediaPlayer.start();
    }

    public void destroy(){
        Timber.d("destroy");
        try {
            mediaPlayer.release();
            uvolInputStream.close();
        } catch (IOException e) {
            e.printStackTrace();
        }

        // Deallocate input stream
    }

    @OnLifecycleEvent(Lifecycle.Event.ON_RESUME)
    public void onResume() {
        Timber.d("onResume");
        if (mediaPlayer!=null && isPrepared)
            Play();
    }

    @OnLifecycleEvent(Lifecycle.Event.ON_PAUSE)
    public void onPause() {
        Timber.d("onPause");
        mediaPlayer.pause();
    }

    @OnLifecycleEvent(Lifecycle.Event.ON_DESTROY)
    public void onDestroy() {
        Timber.d("onDestroy");
        destroy();
    }


    @Override
    public synchronized void onFrameAvailable(SurfaceTexture surfaceTexture) {
        updateSurface = true;

        //Timber.d("onFrameAvailable %d",currentFrame);
    }


    // Call native decode function

    public native Mesh decode(byte[] bytes);
}
