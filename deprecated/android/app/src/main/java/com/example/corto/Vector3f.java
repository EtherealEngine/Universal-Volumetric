package com.example.corto;

import android.opengl.Matrix;
import android.util.Log;

import java.io.Serializable;


public class Vector3f implements Serializable {

    public float x,y,z;
    private float[] vector4f;
    private float[] m;
    private Vector3f res;

    public Vector3f(float x, float y, float z){
        this.x = x;
        this.y = y;
        this.z = z;
        vector4f = new float[4];
        m = new float[16];
        res = new Vector3f();
    }

    private Vector3f(){}

    public Vector3f cross(Vector3f v, Vector3f res){
        float crossX = y * v.z - z * v.y;
        float crossY = z * v.x - x * v.z;
        float crossZ = x * v.y - y * v.x;
        res.x = crossX;
        res.y = crossY;
        res.z = crossZ;
        return res;
    }

    public Vector3f cross(Vector3f v){
        float crossX = y * v.z - z * v.y;
        float crossY = z * v.x - x * v.z;
        float crossZ = x * v.y - y * v.x;
        x = crossX;
        y = crossY;
        z = crossZ;
        return this;
    }
}
