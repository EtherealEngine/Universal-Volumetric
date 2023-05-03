package com.example.corto;

import android.opengl.Matrix;

public abstract class Camera {

    private final float[] vpMatrix;
    protected float[] projectionMatrix;
    private final float[] viewMatrix;
    protected Vector3f eye;
    protected Vector3f center;
    protected Vector3f up;
    protected final float near;
    protected final float far;
    protected int width;
    protected int height;

    public Camera(Vector3f eye, Vector3f center, Vector3f up, float near, float far){
        vpMatrix = new float[16];
        projectionMatrix = new float[16];
        viewMatrix = new float[16];
        this.eye = eye;
        this.center = center;
        this.up = up;
        this.near = near;
        this.far = far;
    }

    protected void createVpMatrix(){
        // Set the camera position (View matrix)
        Matrix.setLookAtM(viewMatrix, 0, eye.x, eye.y, eye.z, center.x, center.y, center.z, up.x, up.y, up.z);
        // Calculate the projection and view transformation
        Matrix.multiplyMM(vpMatrix, 0, projectionMatrix, 0, viewMatrix, 0);
    }

    public abstract void loadVpMatrix();

    public Vector3f getEye(){
        return eye;
    }

    public float[] getVpMatrix(){
        return vpMatrix;
    }

    public Camera setWidth(int width){
        this.width = width;
        return this;
    }

    public Camera setHeight(int height){
        this.height = height;
        return this;
    }
}
