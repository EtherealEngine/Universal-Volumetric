#version 100

precision highp float;


uniform mat4 uMVPMatrix;
uniform mat4 uMMatrix;
uniform mat4 uSTMatrix;
attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec4 aColor;
attribute vec4 aTexCoords;
varying vec4 vColor;
varying vec4 vPosition;
varying vec3 vNormal;
varying vec2 vTexCoords;



void main() {
    vPosition = uMMatrix * aPosition;
    vNormal = normalize(vec3(uMMatrix * vec4(aNormal, 0.0)));
    vColor = aColor;
    vTexCoords = (uSTMatrix * aTexCoords).xy;;
    gl_Position = uMVPMatrix * aPosition;
}
