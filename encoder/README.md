UVol ENCODER

An open source format for streaming meshes and volumetric playback
With extremely fast encode + decode, as well as video sync

Currently playback works in WebGL with three.js
Unity and Unreal support are easy though, get in touch if you're interested!

This format uses Corto for quantized mesh compression
https://github.com/cnr-isti-vclab/corto

Example:
node ./src/Encoder.js example.drcs
Extended Example: 25 FPS, 500 frames
node ./src/Encoder.js example.drcs 25 0 499

Input is a series of .crt files in a folder called "assets"
You can encode these with the corto executable
"assets" folder must be in the same working directory we are calling this script from


# UVOL Encoding

Prerequisites:

Meshlab and NodeJs/NPM?

Step1:

Oopy OBJ sequence to the "assets" folder and confirm the convert.sh file is already in the folder.  If not copy one from the main directory.

Step2:

in the assets folder open a terminal and run the following:
bash convert.sh   

A sequence of PLY files is generated from each OBJ

Step3:

in the same terminal window run:
for FILE in *.ply; do ../corto $FILE; done

A sequence of CRT files in generated from each PLY (this writes really quickly).
Close the terminal

Step4:

Open a new terminal in the directory one level up from "assets" and run:
node src/Encoder30.js filename.drcs

A DRCS and a manifest file are generated once the terminal task is completed.

This drcs and manifest is paired with a mp4 video texture with audio created separate of this process.

