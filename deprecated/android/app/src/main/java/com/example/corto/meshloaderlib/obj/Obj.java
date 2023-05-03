package com.example.corto.meshloaderlib.obj;

import android.content.Context;

import com.example.corto.meshloaderlib.util.Util;

public class Obj {

    private final float[] vertices;
    private final float[] textureCoords;
    private final float[] normals;
    private final int[] indices;
    private final String[] content;
    private Material material;
    private int ioutV = 0;
    private int ioutVt = 0;
    private int ioutVn = 0;

    /**
     * Instantiate Obj.
     * @param context current context.
     * @param filename the filename (.obj) in assets folder.
     */
    public Obj(Context context, String filename){
        content = Util.read(context, filename).split("\n");
        int numVertices = getNumVertices();
        vertices = new float[numVertices * 3];
        textureCoords = new float[numVertices * 2];
        normals = new float[numVertices * 3];
        indices = new int[getNumIndices()];
//        if (useMaterial()){
//            material = new Material(context,getMaterialFileName());
//        }
    }

    /**
     * Load the .obj file.
     */
    public void load(){
        loadFaces();
        loadIndices();
        if (material != null) {
            material.load();
        }
    }

    private float[] loadV(){
        float[] v = new float[getNumV()*3];
        int pos = 0;
        for (String line : content) {
            if (isV(line)) {
                String[] values = line.split(" ");
                pos = Util.addToArray(v,pos,values[1],values[2],values[3]);
            }
        }
        return v;
    }

    private float[] loadVt(){
        float[] vt = new float[getNumVt()*2];
        int pos = 0;
        for (String line : content) {
            if (isVt(line)){
                String[] values = line.split(" ");
                pos = Util.addToArray(vt,pos,values[1],values[2]);
            }
        }
        return vt;
    }

    private float[] loadVn(){
        float[] vn = new float[getNumVn()*3];
        int pos = 0;
        for (String line : content) {
            if (isVn(line)){
                String[] values = line.split(" ");
                pos = Util.addToArray(vn,pos,values[1],values[2],values[3]);
            }
        }
        return vn;
    }

    private void loadIndices(){
        int i = 0;
        int pos = 0;
        for (String line : content){
            if (isF(line)){
                String[] values = line.split(" ");
                int numTriangles = (values.length - 1) - 2;
                int i1 = i;
                for (int j = 0; j < numTriangles; j++) {
                    int i2 = i + 1;
                    int i3 = i + 2;
                    i++;
                    pos = Util.addToArray(indices, pos, i1, i2, i3);
                }
                i += 2;
            }
        }
    }

    private void loadFaces(){
        float[] v = loadV();
        float[] vt = loadVt();
        float[] vn = loadVn();
        for (String line : content){
            if (isF(line)){
                loadFace(line, v, vt, vn);
            }
        }
    }

    private void loadFace(String line, float[] v, float[] vt, float[] vn){
        String[] values = line.split(" ");
        for (int i = 1; i < values.length; i++){
            String[] faceVertex = values[i].split("/");
            int iinV = Integer.parseInt(faceVertex[0]) - 1;
            int iinVt = Integer.parseInt(faceVertex[1]) - 1;
            int iinVn = Integer.parseInt(faceVertex[2]) - 1;
            ioutV = copy(v, iinV, this.vertices, ioutV,3);
            ioutVt = copy(vt, iinVt, this.textureCoords, ioutVt,2);
            ioutVn = copy(vn, iinVn, this.normals, ioutVn,3);
        }
    }

    private int copy(float[] in, int iin, float[] out, int iout, int size){
        if (size >= 0) System.arraycopy(in, iin * size, out, iout * size, size);
        return iout + 1;
    }

    private int getNumV(){
        int num = 0;
        for (String line : content) {
            if (isV(line)) {
                num++;
            }
        }
        return num;
    }

    private int getNumVt(){
        int num = 0;
        for (String line : content) {
            if (isVt(line)) {
                num++;
            }
        }
        return num;
    }

    private int getNumVn(){
        int num = 0;
        for (String line : content) {
            if (isVn(line)) {
                num++;
            }
        }
        return num;
    }

    private int getNumIndices(){
        int num = 0;
        for (String line : content){
            if (isF(line)){
                int numTriangles = (line.split(" ").length - 1) - 2;
                num += numTriangles * 3;
            }
        }
        return num;
    }

    private int getNumVertices(){
        int num = 0;
        for (String line : content){
            if (isF(line)){
                num += line.split(" ").length - 1;
            }
        }
        return num;
    }

    private boolean isV(String line){
        return line.startsWith("v ");
    }

    private boolean isVt(String line){
        return line.startsWith("vt ");
    }

    private boolean isVn(String line){
        return line.startsWith("vn ");
    }

    private boolean isF(String line){
        return line.startsWith("f ");
    }

    /**
     * Return the vertices loaded.
     * @return the vertices.
     */
    public float[] getVertices() {
        return vertices;
    }

    /**
     * Return the texture coordinates loaded.
     * @return the texture coordinates.
     */
    public float[] getTextureCoords() {
        return textureCoords;
    }

    /**
     * Return the normals loaded.
     * @return the normals.
     */
    public float[] getNormals() {
        return normals;
    }

    /**
     * Return the indices loaded.
     * @return the indices.
     */
    public int[] getIndices() {
        return indices;
    }

    private boolean useMaterial(){
        for (String line : content){
            if (line.startsWith("usemtl")){
                return !line.endsWith("None");
            }
        }
        return false;
    }

    private String getMaterialFileName(){
        for (String line : content){
            if (line.startsWith("mtllib")){
                return line.split(" ")[1];
            }
        }
        return null;
    }

    /**
     * Return Material.
     * @return Material.
     */
    public Material getMaterial() {
        return material;
    }
}
