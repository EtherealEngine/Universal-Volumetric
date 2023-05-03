using System;
using System.Diagnostics;
using System.Net.Mime;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Video;
using System.IO;
using SimpleJSON;
using Corto;

public class UniversalVolumetricPlayer : MonoBehaviour
{
    public VideoPlayer videoPlayer;
    public string pathToFile = "";
    string pathToManifestFile = "";

    public bool isStreamingAssets;
    FileStream uvolSource;
    JSONNode frameData;
    float frameRate = 30;
    List<Mesh> meshes = new List<Mesh>();
    CortoMeshLoader loader = new CortoMeshLoader();

    MeshFilter meshFilter;
    Renderer renderer;

    // Start is called before the first frame update
    void Start()
    {
        if(isStreamingAssets){
            pathToFile = Application.streamingAssetsPath + "/" + pathToFile;
        }

        meshFilter =  GetComponent<MeshFilter>();
        renderer = GetComponent<Renderer>();


        if(pathToFile != null && pathToFile != ""){
            Initialize(pathToFile);
        }
    }

    void Initialize(string pathSource){
        var manifestRaw = File.ReadAllText(pathSource.Replace(".uvol", ".manifest"));
        var manifest = JSON.Parse(manifestRaw);

        var versionString = manifest["version"].Value;        // versionString will be a string containing "1.0"
        frameRate = manifest["frameRate"].AsFloat;      // versionNumber will be a float containing 1.0
        var maxVertices = manifest["maxVertices"].AsInt;      // versionNumber will be a float containing 1.0
        var maxTriangles = manifest["maxTriangles"].AsInt;      // versionNumber will be a float containing 1.0
       
        frameData = manifest["frameData"];

        uvolSource = new FileStream(pathSource, FileMode.Open, FileAccess.Read);

        UnityEngine.Debug.Log("Frame Data is" + frameData);
    }

    void ReadFrame(int frameNumber){
        meshes.Clear();
            int start = frameData[frameNumber]["startBytePosition"];
            int length = frameData[frameNumber]["meshLength"];
            UnityEngine.Debug.Log("start, length " + start + " | " + length);
            int end = start + length;
            byte[] meshRaw = new byte[length];

            uvolSource.Position = start;

            uvolSource.Read(meshRaw, 0, length);


            UnityEngine.Debug.Log("numBytesRead" + meshRaw.Length);
            
            // TODO: Decode with corto here
        int numFaces = loader.DecodeMesh(meshRaw, ref meshes);

        if(numFaces > 0)
        {
            UnityEngine.Debug.Log("Mesh fully decoded. Loading mesh to Unity.");
            meshFilter.mesh = meshes[0];
        }


    }

    float bias = -.4f;

    // Update is called once per frame
    void Update()
    {
        if(videoPlayer.isPlaying){
            UnityEngine.Debug.Log(videoPlayer.time);
            if(uvolSource != null) ReadFrame(Mathf.RoundToInt(((float)videoPlayer.time * (float)frameRate) + bias));
        }
    }
}
