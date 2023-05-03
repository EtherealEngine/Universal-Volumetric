package com.example.corto;

import android.content.Context;
import android.opengl.GLES20;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

import timber.log.Timber;

public abstract class Shader {

    private int program;

    public String read(Context context, String filename){

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

    public Shader(Context context, String vs, String fs){
        program = GLES20.glCreateProgram();
        if (program != 0) {
            Timber.d("Shader");
            GLES20.glAttachShader(program, compile(GLES20.GL_VERTEX_SHADER, read(context, vs)));
            checkGlError("glAttachShader");
            GLES20.glAttachShader(program, compile(GLES20.GL_FRAGMENT_SHADER, read(context, fs)));
            checkGlError("glAttachShader");

            GLES20.glLinkProgram(program);
            int[] linkStatus = new int[1];
            GLES20.glGetProgramiv(program, GLES20.GL_LINK_STATUS, linkStatus, 0);
            if (linkStatus[0] != GLES20.GL_TRUE) {
                Timber.e("Could not link program: "+GLES20.glGetProgramInfoLog(program));
                GLES20.glDeleteProgram(program);
                program = 0;
            }
        }
    }

    public abstract void bindData();
    public abstract void unbindData();

    private int compile(int type, String source){
        int shader = GLES20.glCreateShader(type);
        if (shader != 0) {
            GLES20.glShaderSource(shader, source);
            GLES20.glCompileShader(shader);
            int[] compiled = new int[1];
            GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0);
            if (compiled[0] == 0) {
                Timber.e("Could not compile shader %d %s", type , GLES20.glGetShaderInfoLog(shader));
                GLES20.glDeleteShader(shader);
                shader = 0;
            }
        }
        return shader;
    }

    public int getProgram(){
        return program;
    }

    protected int getAttrib(String name){
        int val = GLES20.glGetAttribLocation(program,name);
        checkGlError("glGetAttribLocation "+name);
        if (val == -1) {
            Timber.e("Could not get attrib location for "+name);
        }
        Timber.i("getAttrib %s %d", name, val);
        return val;
    }

    protected int getUniform(String name){
        int val = GLES20.glGetUniformLocation(program,name);
        checkGlError("glGetUniformLocation "+name);
        if (val == -1) {
            Timber.e("Could not get uniform for "+name);
        }
        Timber.i("getUniform %s %d", name, val);
        return val;
    }

    protected void checkGlError(String op) {
        int error;
        while ((error = GLES20.glGetError()) != GLES20.GL_NO_ERROR) {
            Timber.e(op + ": glError " + error);
            throw new RuntimeException(op + ": glError " + error);
        }
    }
}
