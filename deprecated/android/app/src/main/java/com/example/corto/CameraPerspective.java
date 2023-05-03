package com.example.corto;
import android.opengl.Matrix;

public final class CameraPerspective extends Camera {

    public CameraPerspective(Vector3f eye, Vector3f center, Vector3f up, float near, float far) {
        super(eye, center, up, near, far);
    }

    @Override
    public void loadVpMatrix() {
        float ratio = (float)width/(float)height;
        Matrix.frustumM(projectionMatrix, 0, -ratio, ratio, -1, 1, near, far);
        createVpMatrix();
    }
}
