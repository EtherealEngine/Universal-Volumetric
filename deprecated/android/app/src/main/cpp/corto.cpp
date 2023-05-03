#include <jni.h>
#include <string>
#include "decoder.cpp"
#include "meshloader.cpp"
#include <fstream>
#include <iostream>
#include <string>
#include <istream>
#include <sstream>
#include <dirent.h>
#include <android/log.h>

extern "C"
JNIEXPORT jobject Java_com_example_corto_Actor_decode (JNIEnv * env, jobject thiz, jbyteArray bytes){
    std::vector<uint32_t> index;
    std::vector<float> coords;
    std::vector<float> normals;
    std::vector<float> uvs;

    int len = env->GetArrayLength (bytes);
    unsigned char* buf = new unsigned char[len];
    env->GetByteArrayRegion (bytes, 0, len, reinterpret_cast<jbyte*>(buf));

  //  __android_log_write(ANDROID_LOG_DEBUG, "DECODER", "**** FIRST BYTE IS (native)");
 //   __android_log_write(ANDROID_LOG_DEBUG, "DECODER", to_string(buf[0]).c_str());

    crt::Decoder decoder = crt::Decoder(len, buf);

    coords.resize(decoder.nvert*3);
    index.resize(decoder.nface*3);
    uvs.resize(decoder.nvert*2);
    normals.resize(decoder.nvert*3);

    decoder.setPositions(coords.data());
    decoder.setUvs(uvs.data());
    decoder.setNormals(normals.data());
    decoder.setIndex(index.data());

    decoder.decode();

    // Create a jclass from actual Java object class path
    jclass geometryClass = env->FindClass("com/example/corto/Mesh");
    // Get constructor method
    jmethodID methodId = env->GetMethodID(geometryClass, "<init>", "([I[F[F[F)V");

    // Instantiate new object from class

    // Get index
    jfieldID index_id = env -> GetFieldID(geometryClass, "indices", "[I");
    // Get coords
    jfieldID vertices_id = env -> GetFieldID(geometryClass, "vertices", "[F");

    // Get UVs
    jfieldID texCoords_id = env -> GetFieldID(geometryClass, "texCoords", "[F");

    // Get normals
    jfieldID normals_id = env -> GetFieldID(geometryClass, "normals", "[F");



    jintArray jIndex = env -> NewIntArray((index.size()));
    env -> SetIntArrayRegion(jIndex, 0, index.size(), reinterpret_cast<const jint *>(index.data()));

    jfloatArray jCoords = env -> NewFloatArray((coords.size()));
    env -> SetFloatArrayRegion(jCoords, 0, coords.size(), reinterpret_cast<const jfloat *>(coords.data()));

    jfloatArray jUVs = env -> NewFloatArray((uvs.size()));
    env -> SetFloatArrayRegion(jUVs, 0, uvs.size(), reinterpret_cast<const jfloat *>(uvs.data()));

    jfloatArray jNormals = env -> NewFloatArray((normals.size()));
    env -> SetFloatArrayRegion(jNormals, 0, normals.size(), reinterpret_cast<const jfloat *>(normals.data()));

    jobject geometryObj = env->NewObject(geometryClass, methodId, jIndex, jCoords, jNormals, jUVs);

   // __android_log_write(ANDROID_LOG_DEBUG, "DECODER", "to_string(index.size()).c_str()");

   // __android_log_write(ANDROID_LOG_DEBUG, "DECODER", to_string(index.size()).c_str());

    return geometryObj;

   
   
   
   
   std::string dec = "Decoded";
   jstring str = env->NewStringUTF(dec.c_str());

    return str;
}
