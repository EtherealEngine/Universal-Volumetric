package com.example.corto;

import android.content.Context;
import android.media.MediaPlayer;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.util.Log;


import androidx.lifecycle.LifecycleObserver;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

import timber.log.Timber;


public class MeshView extends GLSurfaceView implements GLSurfaceView.Renderer {

    private SceneShader sceneShader;
    private final float[] mMatrix = new float[16];
    private final float[] mvpMatrix = new float[16];
    private CameraPerspective cameraPerspective;
    private static final Vector3f CAMERA_EYE = new Vector3f(3,2,3);
    private static final Vector3f CAMERA_CENTER = new Vector3f(0,0,0);
    private static final Vector3f CAMERA_UP = new Vector3f(0,1,0);

    public Actor actor;

    public MeshView(Context context) {
        super(context);
        setEGLContextClientVersion(2);
        setRenderer(this);
        setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
    }

    public void init(String manifestUrl, int uvolId, int videoId )
    {
        actor = new Actor(getContext(), manifestUrl, uvolId, videoId);
    }

    @Override
    public void onSurfaceCreated(GL10 gl, EGLConfig config) {
        Timber.d("onSurfaceCreated");
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
        GLES20.glDepthFunc(GLES20.GL_LESS);
        GLES20.glClearDepthf(1.0f);
        GLES20.glFrontFace(GLES20.GL_CCW);

        cameraPerspective = new CameraPerspective(CAMERA_EYE, CAMERA_CENTER, CAMERA_UP, 1, 1000);
        // actor.mesh = new Mesh(getContext(),"monkey.obj");
        actor.onSurfaceCreated();
        sceneShader = new SceneShader(getContext());
    }

    @Override
    public void onSurfaceChanged(GL10 gl, int width, int height) {
        Timber.d("onSurfaceChanged");
        GLES20.glViewport(0, 0, width, height);
        cameraPerspective.setWidth(width).setHeight(height);
    }

    @Override
    public void onDrawFrame(GL10 gl) {
        //Timber.d("onDrawFrame");
        GLES20.glClearColor(1, 0, 0, 1);
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        cameraPerspective.loadVpMatrix();
        sceneShader.setViewPos(cameraPerspective.getEye());
        Matrix.setIdentityM(mMatrix, 0);
        Matrix.multiplyMM(mvpMatrix, 0, cameraPerspective.getVpMatrix(), 0, mMatrix, 0);
        sceneShader.setMMatrix(mMatrix);
        sceneShader.setMvpMatrix(mvpMatrix);

        if(actor != null){
            actor.updateFrame();
            sceneShader.draw(actor.mesh);
        }
    }

    public LifecycleObserver getLifeCycleObserver()
    {
        return actor;
    }


}
