package com.example.corto;

import android.content.Context;
import android.opengl.Matrix;

import com.example.corto.meshloaderlib.obj.Obj;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.IntBuffer;
import java.util.Arrays;

public class Mesh {

    private int[] indices;
    private float[] vertices;
    private float[] normals;
    private float[] texCoords;
    private final int sizeVertex;
    private FloatBuffer vertexBuffer;
    private FloatBuffer normalBuffer;
    private FloatBuffer texCoordsBuffer;
    private IntBuffer indicesBuffer;
    protected Vector3f position;
    protected Vector3f rotation;
    protected float scale;
    protected int textureId;
    protected float[] stMatrix;


    public Mesh(){
        this.sizeVertex = 3;
        position = new Vector3f(0,0,0);
        rotation = new Vector3f(0,0,0);
        scale = .1f;
    }

    public Mesh(int[] indices, float[] vertices, float[] normals, float[] texCoords){
        this.sizeVertex = 3;
        position = new Vector3f(0,0,0);
        rotation = new Vector3f(0,0,0);

        this.indices = indices;
        this.vertices = vertices;
        this.normals = normals;
        this.texCoords = texCoords;

        scale = .1f;
    }


    public Mesh(Context context, String mesh){
        this.sizeVertex = 3;
        loadFromFile(context,mesh);
        init();
    }

    private void loadFromFile(Context context, String fileName){
            Obj obj = new Obj(context, fileName);
            obj.load();
            this.vertices = obj.getVertices();
            this.texCoords = obj.getTextureCoords();
            this.normals = obj.getNormals();
            this.indices = obj.getIndices();
    }

    public void init(){
        load();
    }

    public void setParameter(int textureId, float[] stMatrix)
    {
        this.textureId = textureId;
        this.stMatrix = stMatrix;
    }

    private void load(){
        loadVertices();
        loadNormals();
        loadTexCoords();
        loadIndices();
    }

    private void loadVertices(){
        ByteBuffer bbVertex = ByteBuffer.allocateDirect(vertices.length * 4);
        bbVertex.order(ByteOrder.nativeOrder());
        vertexBuffer = bbVertex.asFloatBuffer();
        vertexBuffer.put(vertices);
        vertexBuffer.position(0);
    }

    private void loadNormals(){
        ByteBuffer bbNormal = ByteBuffer.allocateDirect(normals.length * 4);
        bbNormal.order(ByteOrder.nativeOrder());
        normalBuffer = bbNormal.asFloatBuffer();
        normalBuffer.put(normals);
        normalBuffer.position(0);
    }

    private void loadTexCoords(){
        if (texCoords == null) {
            texCoords = new float[getNumVertices() * 2];
            Arrays.fill(texCoords,0);
        }
        ByteBuffer bbTexCoords = ByteBuffer.allocateDirect(texCoords.length * 4);
        bbTexCoords.order(ByteOrder.nativeOrder());
        texCoordsBuffer = bbTexCoords.asFloatBuffer();
        texCoordsBuffer.put(texCoords);
        texCoordsBuffer.position(0);
    }

    private void loadIndices(){
        if (indices != null) {
            ByteBuffer bbIndices = ByteBuffer.allocateDirect(indices.length * 4);
            bbIndices.order(ByteOrder.nativeOrder());
            indicesBuffer = bbIndices.asIntBuffer();
            indicesBuffer.put(indices);
            indicesBuffer.position(0);
        }
    }

    public FloatBuffer getVertexBuffer(){
        return vertexBuffer;
    }

    public FloatBuffer getNormalBuffer(){
        return normalBuffer;
    }

    public FloatBuffer getTexCoordsBuffer() {
        return texCoordsBuffer;
    }

    public IntBuffer getIndicesBuffer(){
        return indicesBuffer;
    }

    public int getSizeVertex(){
        return sizeVertex;
    }

    public int getNumVertices(){
        return vertices.length/sizeVertex;
    }

    public int getTextureId() {
        return textureId;
    }


    public float[] getStMatrix() {
        return stMatrix;
    }
}
