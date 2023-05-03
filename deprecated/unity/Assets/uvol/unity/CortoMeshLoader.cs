using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

namespace Corto
{
    public unsafe class CortoMeshLoader
    {
        #region - METHODS
        public int DecodeMesh(byte[] data, ref List<Mesh> meshes)
        {
            Vector2[] decoderInfo = new Vector2[1]; // x = nface, y = nvert
            IntPtr decoder = CreateDecoder(data.Length, data, decoderInfo);

            int[] indices = new int[(int)decoderInfo[0].x * 3];
            Vector3[] vertices = new Vector3[(int)decoderInfo[0].y];
            Vector3[] normals = new Vector3[(int)decoderInfo[0].y];
            Color[] colors = new Color[(int)decoderInfo[0].y];
            Vector2[] uvs = new Vector2[(int)decoderInfo[0].y];

            if(DecodeMesh(decoder, vertices, indices, normals, colors, uvs) <= 0)
            {
                Debug.LogWarning("Failed: Decoding error.");
                return -1;
            }

            DestroyDecoder(decoder);
            
            decoderInfo[0] = Vector2.zero;

            // TODO : Use 16bit if it's enough for the mesh (low priority)
            Mesh mesh = new Mesh
            {
                indexFormat = UnityEngine.Rendering.IndexFormat.UInt16,
                vertices = vertices,
                triangles = indices,
                uv = uvs
            };

            // if(normals.Length > 0)
            // {
            //     //mesh.normals = normals;
            //     mesh.RecalculateNormals();
            // }
            // else
            // {
            //     Debug.Log("Mesh does not have normals. Recomputing...");
            //     mesh.RecalculateNormals();
            // }

            // if(colors.Length > 0)
            // {
            //     mesh.colors = colors;
            // }

            meshes.Add(mesh);

            return mesh.triangles.Length / 3;
        }

        // TODO: If porting to WebGL, use the Javascript code
        [DllImport("cortocodec_unity", EntryPoint = "CreateDecoder")]
        private static extern IntPtr CreateDecoder(int length, byte[] data, [In, Out] Vector2[] decoderInfo);
        [DllImport("cortocodec_unity", EntryPoint = "DestroyDecoder")]
        private static extern void DestroyDecoder(IntPtr decoder);
        [DllImport("cortocodec_unity", EntryPoint = "DecodeMesh")]
        private static extern int DecodeMesh(IntPtr decoder, [In, Out] Vector3[] vertices, [In, Out] int[] indices, [In, Out] Vector3[] normals, [In, Out] Color[] colors, [In, Out] Vector2[] texcoord);
        #endregion
    }
}