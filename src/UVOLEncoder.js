import fs from 'fs';
import glob from 'glob';
import { program } from 'commander';

program
  .name('universal-volumetric')
  .description('CLI to encoder geometry files into UVOL format')
  .version('2.0.0');

program
  .option(
    '-gc, --geometry-compression <type>',
    'Compression type of 3D geometries'
  )
  .option(
    '-tc, --texture-compression <type>',
    'Compression type of 3D textures. Default value: mp4'
  )
  .option(
    '-f, --framerate <value>',
    'Frame rate of the output volumetric video. Default value: 30 fps'
  )
  .option('-v, --verbose')
  .option(
    '-i, --input-path <path>',
    'Directory that contains 3d models (drc or crt files)'
  )
  .argument('<output-file-name>', 'Output filename')
  .option('--start-frame <value>', 'Default value: 0')
  .option('--end-frame <value>', 'Default value: Total number of frames - 1');

function performArgChecks(options, args) {
  if (!options.geometryCompression || !options.inputPath || !args) {
    console.error('Please pass the required arguments');
    process.exit(1);
  }
  if (
    options.geometryCompression != 'draco' &&
    options.geometryCompression != 'corto'
  ) {
    console.error("Geomtetry Compression can be either 'draco' or 'corto'");
    process.exit(1);
  }

  if (!options.textureCompression) {
    options.textureCompression = 'mp4';
  } else if (options.textureCompression != 'mp4') {
    console.error('Currently only mp4 texture is supported');
    process.exit(1);
  }

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

  if (!options.startFrame) {
    options.startFrame = 0;
  } else {
    options.startFrame = parseInt(options.startFrame);
  }
  if (options.endFrame) {
    options.endFrame = parseInt(options.endFrame);
  }
}

function constructUVOL(
  geometryCompression,
  textureCompression,
  frameRate,
  inputPath,
  startFrame,
  endFrame,
  outputFile,
  verbose
) {
  let meshFiles = [];
  const filePattern = geometryCompression == 'draco' ? '*.drc' : '*.crt';

  meshFiles = glob.sync(inputPath + filePattern);
  if (verbose) {
    console.log(`Number of ${geometryCompression} files: `, meshFiles.length);
  }

  startFrame = parseInt(startFrame);
  if (!endFrame) {
    endFrame = startFrame + meshFiles.length - 1;
  } else if (endFrame - startFrame + 1 != meshFiles.length) {
    console.error(
      'Incompatible start-frame, end-frame arguments with the number of mesh files in input-path'
    );
    process.exit(1);
  }

  let writeBuffer = Buffer.alloc(0);
  let currentPositionInWriteStream = 0;

  const manifestData = {
    version: '2.0.0',
    frameRate: frameRate,
    geometryCompression: geometryCompression,
    textureCompression: textureCompression,
    frameData: [],
  };

  for (let i = startFrame; i <= endFrame; i++) {
    const rawData = fs.readFileSync(meshFiles[i - startFrame]);
    const rawBuffer = Buffer.from(rawData);
    writeBuffer = Buffer.concat([writeBuffer, rawBuffer]);
    manifestData.frameData.push([i, currentPositionInWriteStream]);
    currentPositionInWriteStream += rawBuffer.byteLength;
  }

  const uvolStream = fs.createWriteStream(outputFile);
  uvolStream.write(writeBuffer, (err) => {
    if (err) {
      console.error('Error in writing to UVOL file: ', err);
    }
  });
  uvolStream.end();

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
  options.geometryCompression,
  options.textureCompression,
  options.framerate,
  options.inputPath,
  options.startFrame,
  options.endFrame,
  args[0],
  options.verbose
);
