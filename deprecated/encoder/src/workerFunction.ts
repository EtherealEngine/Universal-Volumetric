importScripts(location.origin + '/corto/corto.js', location.origin + '/corto/rangeFetcher.js');

let _meshFilePath;
let currentKeyframe = 0;
let fetchLoop;
let lastRequestedKeyframe = -1;
let _numberOfKeyframes;
let _fileHeader;

function startFetching({
  meshFilePath,
  numberOfKeyframes,
  fileHeader
}) {
  //@ts-ignore
  let rangeFetcher = new HttpRangeFetcher({});
  console.log("Range fetcher");
  console.log(rangeFetcher);
  _meshFilePath = meshFilePath;
  _numberOfKeyframes = numberOfKeyframes;
  _fileHeader = fileHeader;
  (globalThis as any).postMessage({ type: "initialized" });



  fetchLoop = setInterval(() => {
    if (lastRequestedKeyframe >= _numberOfKeyframes) {
      clearInterval(fetchLoop);
      (globalThis as any).postMessage({ type: "complete" });
    }

    // Now increment one more
    lastRequestedKeyframe++;
    // This is our new keyframe
    const newKeyframe = lastRequestedKeyframe;


    const keyframe = _fileHeader.frameData[newKeyframe];
    if (keyframe === undefined) return console.log("Keyframe undefined");
    // Get count of frames associated with keyframe
    const iframes = _fileHeader.frameData.filter(frame => frame.keyframeNumber === newKeyframe && frame.keyframeNumber !== frame.frameNumber).sort((a, b) => (a.frameNumber < b.frameNumber));

    const requestStartBytePosition = keyframe.startBytePosition;

    const requestEndBytePosition = iframes.length > 0 ?
      iframes[iframes.length - 1].startBytePosition + iframes[iframes.length - 1].meshLength - requestStartBytePosition
      : keyframe.startBytePosition + keyframe.meshLength - requestStartBytePosition;

    rangeFetcher.getRange(_meshFilePath, requestStartBytePosition, requestEndBytePosition).then(response => {

      // Slice keyframe out by byte position
      const keyframeStartPosition = 0;
      const keyframeEndPosition = keyframe.meshLength;

      //@ts-ignore
      let decoder = new CortoDecoder(response.buffer.buffer, keyframeStartPosition, keyframeEndPosition);
      let keyframeMeshData = decoder.decode();

      ////////////////////
      // Slice data from returned response and decode
      ////////////////////

      // decode corto data and create a temp buffer geometry
      const bufferObject = {
        frameNumber: keyframe.frameNumber,
        keyframeNumber: keyframe.keyframeNumber,
        bufferGeometry: keyframeMeshData
      };

      const message = {
        keyframeBufferObject: bufferObject,
        //   iframeBufferObjects: []
      };

      // // For each iframe...
      // for (const frameNo in iframes) {
      //   const iframe = iframes[frameNo];
      //   console.log("iframe is", iframes[frameNo]);
      //   const frameStartPosition = iframe.startBytePosition - requestStartBytePosition;
      //   const frameEndPosition = iframe.meshLength + frameStartPosition;
      //   console.log("frame start position: ", frameStartPosition, "frame end position:", frameEndPosition);
      //   // Slice iframe out, decode into list of position vectors

      //   //@ts-ignore
      //   let decoder = new CortoDecoder(response, frameStartPosition, frameEndPosition);
      //   let meshData = decoder.decode();
      //   let geometry = new BufferGeometry();
      //   geometry.setIndex(
      //     new Uint32BufferAttribute(keyframeMeshData.index, 1)
      //   );
      //   geometry.setAttribute(
      //     'position',
      //     new Float32BufferAttribute(meshData.position, 3)
      //   );
      //   geometry.setAttribute(
      //     'uv',
      //     new Float32BufferAttribute(keyframeMeshData.uv, 2)
      //   );

      //   console.log("Iframe meshData is", meshData);
      //   console.log("Decoded iframe", frameNo, "meshData is", meshData);
      //   // Check if iframe position is in ring buffer -- if so, update it, otherwise set it
      //   // decode corto data and create a temp buffer geometry
      //   const bufferObject: IFrameBuffer = {
      //     frameNumber: iframe.frameNumber,
      //     keyframeNumber: iframe.keyframeNumber,
      //     vertexBuffer: geometry
      //   };

      //   message.iframeBufferObjects.push(bufferObject);
      // }

      (globalThis as any).postMessage({ type: 'framedata', payload: message });

    });
  }, 1000 / 60);

}

(globalThis as any).onmessage = function (e) {
  console.log('Received input: ', e.data); // message received from main thread
  if (e.data.type === 'initialize')
    startFetching(e.data.payload);
};
