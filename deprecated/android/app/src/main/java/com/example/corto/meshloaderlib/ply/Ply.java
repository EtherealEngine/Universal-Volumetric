package com.example.corto.meshloaderlib.ply;

import android.content.Context;

import com.example.corto.meshloaderlib.util.Util;

public class Ply {

    private float[] vertices = null;
    private float[] normals = null;
    private float[] colors = null;
    private float[] uvs = null;
    private int[] indices = null;
    private final String[] content;

    /**
     * Instantiate Ply.
     * @param context current context.
     * @param filename the filename (.ply) in assets folder.
     */
    public Ply(Context context, String filename){
        content = Util.read(context, filename).split("end_header\n");
    }

    /**
     * Return the vertices loaded.
     * @return the vertices.
     */
    public float[] getVertices(){
        return vertices;
    }

    /**
     * Return the normals loaded.
     * @return the normals.
     */
    public float[] getNormals(){
        return normals;
    }

    /**
     * Return the colors loaded.
     * @return the colors.
     */
    public float[] getColors(){
        return colors;
    }

    /**
     * Return the uvs loaded.
     * @return the uvs.
     */
    public float[] getUvs(){
        return uvs;
    }

    /**
     * Return the indices loaded.
     * @return the indices.
     */
    public int[] getIndices(){
        return indices;
    }

    /**
     * Load the .ply file.
     */
    public void load(){
        String[] header = content[0].split("\n");
        String[] data = content[1].split("\n");
        int numVertices = getNumVertices(data);
        int numIndices = getNumIndices(data);
        vertices = new float[numVertices*3];
        normals = new float[numVertices*3];
        if (isColored(header)) {
            colors = new float[numVertices*4];
        }
        if (isTextured(header)){
            uvs = new float[numVertices*2];
        }
        indices = new int[numIndices*3];
        loadVertices(data);
        loadNormals(data);
        if (isColored(header)) {
            loadColors(data);
        }
        if (isTextured(header)){
            loadTextureCoords(data);
        }
        loadIndices(data);
    }

    private boolean isTextured(String[] header){
        for (String line : header) {
            if (line.compareTo("property float s") == 0) {
                return true;
            }
        }
        return false;
    }

    private boolean isColored(String[] header){
        for (String line : header) {
            if (line.compareTo("property uchar red") == 0) {
                return true;
            }
        }
        return false;
    }

    private int getNumVertices(String[] data){
        int numVertices = 0;
        for (String line : data) {
            String[] values = line.split(" ");
            if (isFloat(values[0])) {
                numVertices++;
            }
        }
        return numVertices;
    }

    private int getNumIndices(String[] data){
        int numIndices = 0;
        for (String line : data) {
            String[] values = line.split(" ");
            if (!isFloat(values[0])) {
                int num = Integer.parseInt(values[0]);
                for (int i = 1; i < num - 1; i++){
                    numIndices += 3;
                }
            }
        }
        return numIndices;
    }

    private void loadVertices(String[] data) {
        int pos = 0;
        for (String line : data) {
            String[] values = line.split(" ");
            if (isFloat(values[0])) {
                pos = Util.addToArray(vertices,pos,values[0],values[1],values[2]);
            }
        }
    }

    private void loadNormals(String[] data){
        int pos = 0;
        for (String line : data) {
            String[] values = line.split(" ");
            if (isFloat(values[0])) {
                pos = Util.addToArray(normals,pos,values[3],values[4],values[5]);
            }
        }
    }

    private void loadColors(String[] data){
        int pos = 0;
        for (String line : data) {
            String[] values = line.split(" ");
            if (isFloat(values[0])) {
                float c1 = Float.parseFloat(values[6]) / 255f;
                float c2 = Float.parseFloat(values[7]) / 255f;
                float c3 = Float.parseFloat(values[8]) / 255f;
                float c4 = 1f;
                if (values.length == 10) {
                    c4 = Float.parseFloat(values[9]) / 255f;
                }
                pos = Util.addToArray(colors,pos,c1,c2,c3,c4);
            }
        }
    }

    private void loadTextureCoords(String[] data){
        int pos = 0;
        for (String line : data) {
            String[] values = line.split(" ");
            if (isFloat(values[0])) {
                pos = Util.addToArray(uvs,pos,values[6],values[7]);
            }
        }
    }

    private void loadIndices(String[] data){
        int pos = 0;
        for (String line : data) {
            String[] values = line.split(" ");
            if (!isFloat(values[0])) {
                int num = Integer.parseInt(values[0]);
                for (int i = 1; i < num - 1; i++){
                    pos = Util.addToArray(indices,pos,values[1],values[i+1],values[i+2]);
                }
            }
        }
    }

    private boolean isFloat(String value){
        return value.contains(".");
    }
}
