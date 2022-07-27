// DRACOSIS ENCODER
// Written by Shaw for XR3ngine
// MIT licensed

// This encoder uses Corto for quantized mesh compression
// https://github.com/cnr-isti-vclab/corto

// Example:
// node ./src/Encoder.js example.drcs
// Extended Example: 25 FPS, 500 frames
// node ./src/Encoder.js example.drcs 25 0 499

// Input is a series of .crt files in a folder called "assets"
// You can encode these with the corto executable
// "assets" folder must be in the same working directory we are calling this script from

import glob from 'glob';
import fs from 'fs';
import THREE from 'three';
import "./libs/THREECORTOLoader.js"
import CortoDecoder from './libs/cortodecoder.js';
import HttpRequest from 'xmlhttprequest';

const { CORTOLoader } = THREE;

global.XMLHttpRequest = HttpRequest.XMLHttpRequest;

// Command line args
const myArgs = process.argv.slice(2);
const outputFileName = myArgs[0];
const frameRate = myArgs[1] ?? 25;
const frameIn = myArgs[2] ?? 0;
const frameOut = myArgs[3] ?? -1;

class CortosisFileCreator {
  _meshFile;
  _frameData;
  _maxVertices;
  _maxFaces;
  _manager;
  _loader;
  mesh;
  keyframeGeometry;
  _frameIn;
  _frameOut;
  _outputFileName;

  lastKeyframe = 0;

  constructor(
    frameIn,
    frameOut,
    outputFileName,
    frameRate,
    progressCallback
  ) {
    this._meshFiles = [];
    this._frameData = [];
    this._maxVertices = 0;
    this._maxFaces = 0;
    this._manager = new THREE.LoadingManager();
    this._loader = new CORTOLoader({}, this._manager);
    this.keyframeGeometry = new THREE.BufferGeometry();
    this._frameIn = frameIn;
    this._frameOut = frameOut;
    this._frameIn = frameIn;
    this.frameRate = frameRate;
    this._outputFileName = outputFileName;
    this._manager.onProgress = (item, loaded, total) => {
      if (progressCallback) progressCallback(item, loaded, total);
    };

    const dir = process.cwd() + '/' + 'assets/';
    glob(dir + '*.crt', {}, (err, files) => {
      if (err) console.error(err);
      this._meshFiles = files;
      this.createEncodedFile(this._outputFileName, () => { "file created! " });
    });
  }

  createEncodedFile = async (
    fileName,
    callback
  ) => {
    console.log('Writing file to ' + fileName);
    let writeBuffer = Buffer.alloc(0);
    let currentPositionInWriteStream = 0;
    // If user specificies frame out, this it the range we process
    const frameOut = this._frameOut > 0 ? this._frameOut : this._meshFiles.length;
    // Iterate over all files and write an output file
    for (let i = this._frameIn; i < frameOut; i++) {

      // Load CRT file
      let rawObjDataCRT = fs.readFileSync(this._meshFiles[i]);
      let rawCRTFrame = Buffer.from(rawObjDataCRT)
      let decoder = new CortoDecoder(rawObjDataCRT.buffer);
      let objData = decoder.decode();

      if (objData !== null) {
        this.lastKeyframe = i;
        this.keyframeGeometry = new THREE.BufferGeometry();
        this.keyframeGeometry.setAttribute("position", objData.position);
        this.keyframeGeometry.setAttribute("uv", objData.uv);
        this.keyframeGeometry.index = objData.index;

        const numberOfVerts = objData.nvert;
        const numberOfFaces = objData.nface;

        console.log("Processing frame ", i, " | ", "Number of vertices: ", numberOfVerts);

        if (numberOfVerts > this._maxVertices)
          this._maxVertices = numberOfVerts;
        if (this.keyframeGeometry.index && numberOfFaces > this._maxFaces)
          this._maxFaces = numberOfFaces

        const frame = {
          frameNumber: i,
          keyframeNumber: i,
          startBytePosition: currentPositionInWriteStream,
          vertices: numberOfVerts,
          faces: numberOfFaces,
          meshLength: rawCRTFrame.byteLength,
          type: 'mesh'
        };

        // Add to the data array
        this._frameData.push(frame);
      } else {
        console.log("Mesh not returned, must be iframe");

        const frame = {
          frameNumber: i,
          keyframeNumber: this.lastKeyframe,
          startBytePosition: currentPositionInWriteStream,
          vertices: numberOfVerts,
          faces: numberOfFaces,
          meshLength: rawCRTFrame.byteLength,
          type: 'group'
        };

        this._frameData.push(frame);
      }

      // Write to file stream, mesh first
      writeBuffer = Buffer.concat([writeBuffer, Buffer.from(rawCRTFrame)]);
      currentPositionInWriteStream += rawCRTFrame.byteLength

      // update progress callback
      rawCRTFrame = null;
      objData = null;

      // progress callback
      if (callback) callback(i - this._frameIn / frameOut - this._frameIn);
    }


    // create object with maxVertices, textureWidth and textureHeight, then pack frames {} in
    const fileData = {
      frameRate: this.frameRate,
      maxVertices: this._maxVertices,
      maxTriangles: this._maxFaces,
      frameData: this._frameData,
    };

    // // Convert our file info into buffer and save to file stream
    const fileDataBuffer = Buffer.from(JSON.stringify(fileData), 'utf-8');

    const manifestStream = fs.createWriteStream(fileName.replace('drcs', 'manifest'));
    manifestStream.write(fileDataBuffer, err => {
      if (err) console.log("ERROR", err);
    });

    manifestStream.close;

    const dracosisStream = fs.createWriteStream(fileName);
    dracosisStream.write(writeBuffer, err => {
      if (err)
        console.log("ERROR", err);
    });

    dracosisStream.close;

    // Progress callback
    if (callback) callback(1);
  };
}

new CortosisFileCreator(frameIn, frameOut, outputFileName, frameRate, () => {
  console.log('Converted to Dracosis');
});