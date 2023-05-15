import fs from 'fs'
import glob from 'glob'
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

function generateStartBytes(fileList, outputFileWriter) {
  let outputBuffer = Buffer.alloc(0)
  const frameData = []
  fileList.forEach(function (fileName, index) {
    const rawData = fs.readFileSync(fileName)
    const rawBuffer = Buffer.from(rawData)
    frameData.push(outputFileWriter.currentWritePosition)
    outputBuffer = Buffer.concat([outputBuffer, rawBuffer])
    outputFileWriter.currentWritePosition += rawBuffer.byteLength
  })

  outputFileWriter.writer.write(outputBuffer, (err) => {
    if (err) {
      console.error(`Error in writing to output file [${outputFile}]: `, err)
    }
  })
  return frameData
}

function constructUVOL() {
  const configPath = process.argv[2]
  const rawConfig = fs.readFileSync(configPath)
  const config = JSON.parse(rawConfig)
  
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  config.outputDirectory = path.resolve(config.outputDirectory)
  config.outputFile = path.join(config.outputDirectory, config.name + '.uvol')

  if (!config.dracoFilesPath && !config.OBJFilesPath) {
    /**
     * If both dracoFilesPath and OBJFilesPath are not supplied,
     * we look for ABCFilePath and convert them into OBJ files.
     * After this step, either OBJFilesPath or dracoFilesPath is definitely defined
     */
    const scriptPath = path.join(__dirname, '..', 'scripts', 'abc_to_obj.py')
    config.OBJFilesPath = path.join(config.outputDirectory, config.name, 'OBJ')
    fs.mkdirSync(config.dracoFilesPath, { recursive: true })
    console.log(
      'Extracting frames from alembic file and converting them to OBJ files, directory: ',
      config.OBJFilesPath
    )
    config.ABCFilePath = path.resolve(config.ABCFilePath)
    const status = spawnSync('python3', [scriptPath, config.ABCFilePath, config.OBJFilesPath])
    if (status.status) {
      console.error('Error: ', status.stderr.toString('utf8'), status.stderr.toString('utf8').length)
    } else console.log('Done')
  }

  if (!config.dracoFilesPath) {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'objs_to_drcs.sh')
    config.dracoFilesPath = path.join(config.outputDirectory, config.name, 'DRC')
    fs.mkdirSync(config.dracoFilesPath, { recursive: true })
    console.log('Compressing OBJ files into DRACO files, directory: ', config.dracoFilesPath)
    config.OBJFilesPath = path.resolve(config.OBJFilesPath)
    const status = spawnSync('bash', [
      scriptPath,
      path.resolve(config.OBJFilesPath),
      path.resolve(config.dracoFilesPath),
      config.COMPRESSION_LEVEL || '',
      config.Q_POSITION_ATTR || '',
      config.Q_TEXTURE_ATTR || '',
      config.Q_NORMAL_ATTR || '',
      config.Q_GENERIC_ATTR || ''
    ])
    if (status.status) {
      console.error('Error: ', status.stdout.toString('utf8'))
    } else console.log('Done')
  }

  if (config.textureType != 'ktx2' && !config.videoTextureInputPath) {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'image_to_mp4.sh')
    config.videoTextureInputPath = config.outputFile.replace('uvol', 'mp4')
    config.imageTextureInputPath = path.resolve(config.imageTextureInputPath)
    console.log('Creating video texture with images and audio: ', config.videoTextureInputPath)
    const status = spawnSync('bash', [
      scriptPath,
      config.imageTextureInputPath,
      config.videoTextureInputPath,
      config.frameRate,
      config.width,
      config.height,
      config.audioPath
    ])
    if (status.status) {
      console.error('Error: ', status.stderr.toString('utf8'))
    } else console.log('Done')
  }

  const manifestData = {
    version: '2.0.0',
    geometry: {
      frameRate: config.frameRate,
      startFrame: config.geometryStartFrame,
      frameData: [],
      compression: 'draco'
    },
    texture: {
      frameRate: config.frameRate,
      // startFrame: textureStartFrame,
      // frameData: [],
      compression: config.textureType || 'mp4'
    }
  }
  const meshFiles = glob.sync(path.join(config.dracoFilesPath, '*.drc'))
  console.log('Number of draco files: ', meshFiles.length)

  const outputStream = fs.createWriteStream(config.outputFile)
  const outputFileWriter = {
    writer: outputStream,
    currentWritePosition: 0
  }
  manifestData.geometry.frameData = generateStartBytes(meshFiles, outputFileWriter)

  if (config.textureType === 'ktx2') {
    manifestData['texture']['startFrame'] = textureStartFrame
    const textureFiles = glob.sync(geometryInputPath + '*.ktx2')
    if (verbose) {
      console.log('Number of ktx2 files: ', textureFiles.length)
    }
    manifestData.texture.frameData = generateStartBytes(textureFiles, outputFileWriter)
  }
  outputFileWriter.writer.end()

  const manifestStream = fs.createWriteStream(config.outputFile.replace('uvol', 'manifest'))

  const manifestBuffer = Buffer.from(JSON.stringify(manifestData), 'utf-8')
  manifestStream.write(manifestBuffer, (err) => {
    if (err) {
      console.error('Error in writing to manifest file: ', err)
    }
  })
  manifestStream.end()
}

constructUVOL()
