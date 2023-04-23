import fs from 'fs';
import glob from 'glob';
import { program } from 'commander';

program
  .name('universal-volumetric')
  .description('CLI to encoder geometry files into UVOL format')
  .version('2.0.0');

program
  .option(
    '-tc, --texture-compression <type>',
    'Compression type of 3D textures. Default value: mp4'
  )
  .option(
    '-f, --frame-rate <value>',
    'Frame rate of the output volumetric video. Default value: 30 fps'
  )
  .option('-v, --verbose')
  .option(
    '-i, --input-path <path>',
    'Directory that contains 3d models (drc or crt files)'
  )
  .argument('<output-file-name>', 'Output filename')
  .option('--geometry-start-frame <value>', 'Default value: 0')
  .option('--texture-start-frame <value>', 'Default value: 0');

function performArgChecks(options, args) {
  if (
    !(
      fs.existsSync(options.inputPath) &&
      fs.lstatSync(options.inputPath).isDirectory()
    )
  ) {
    console.error('Input path is invalid');
    process.exit(1);
  } else if (!options.inputPath.endsWith('/')) {
    options.inputPath += '/';
  }

  if (!options.geometryStartFrame) {
    options.geometryStartFrame = 0;
  } else {
    options.geometryStartFrame = parseInt(options.geometryStartFrame);
  }
  if (!options.textureStartFrame) {
    options.textureStartFrame = 0;
  } else {
    options.textureStartFrame = parseInt(options.textureStartFrame);
  }

  options.frameRate = parseInt(options.frameRate);
}

function generateStartBytes(fileList, outputFile) {
  let outputBuffer = Buffer.alloc(0);
  let currentWritePosition = 0;
  const frameData = [];
  fileList.forEach(function (fileName, index) {
    const rawData = fs.readFileSync(fileName);
    const rawBuffer = Buffer.from(rawData);
    frameData.push(currentWritePosition);
    outputBuffer = Buffer.concat([outputBuffer, rawBuffer]);
    currentWritePosition += rawBuffer.byteLength;
  });
  const outputStream = fs.createWriteStream(outputFile);
  outputStream.write(outputBuffer, (err) => {
    if (err) {
      console.error(`Error in writing to output file [${outputFile}]: `, err);
    }
  });
  outputStream.end();
  return frameData;
}

function constructUVOL(
  textureCompression,
  frameRate,
  inputPath,
  geometryStartFrame,
  textureStartFrame,
  outputFile,
  verbose
) {
  const manifestData = {
    version: '2.0.0',
    geometry: {
      frameRate: frameRate,
      startFrame: geometryStartFrame,
      frameData: [],
      compression: 'draco',
    },
    texture: {
      frameRate: frameRate,
      // startFrame: textureStartFrame,
      // frameData: [],
      compression: textureCompression || 'mp4',
    },
  };
  const meshFiles = glob.sync(inputPath + '*.drc');
  if (verbose) {
    console.log('Number of draco files: ', meshFiles.length);
  }
  manifestData.geometry.frameData = generateStartBytes(meshFiles, outputFile);

  if (textureCompression === 'ktx2') {
    manifestData['texture']['startFrame'] = textureStartFrame;
    const textureFiles = glob.sync(inputPath + '*.ktx2');
    if (verbose) {
      console.log('Number of ktx2 files: ', textureFiles.length);
    }
    manifestData.texture.frameData = generateStartBytes(
      textureFiles,
      outputFile.replace('uvol', 'texture')
    );
  }

  const manifestStream = fs.createWriteStream(
    outputFile.replace('uvol', 'manifest')
  );

  const manifestBuffer = Buffer.from(JSON.stringify(manifestData), 'utf-8');
  manifestStream.write(manifestBuffer, (err) => {
    if (err) {
      console.error('Error in writing to manifest file: ', err);
    }
  });
  manifestStream.end();
}

program.parse(process.argv);

const options = program.opts();
const args = program.args;

performArgChecks(options, args);
constructUVOL(
  options.textureCompression,
  options.frameRate,
  options.inputPath,
  options.geometryStartFrame,
  options.textureStartFrame,
  args[0],
  options.verbose
);
