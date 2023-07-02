from shutil import which
import sys
import json
from rich.progress import track
import bpy
import os
import subprocess
import shlex
from tqdm import tqdm
import re


import io
from contextlib import redirect_stdout


def check_executables():
    ok = True
    if not which("draco_encoder"):
        print(
            "❌ 'draco_encoder' command doesn't exist. Please build it from https://github.com/google/draco"
        )
        ok = False
    if not which("basisu"):
        print(
            "❌ 'basisu' command doesn't exist. Please build it from https://github.com/BinomialLLC/basis_universal"
        )
        ok = False
    if not ok:
        exit(1)


def main():
    check_executables()
    if len(sys.argv) != 2:
        print(
            "❌ Invalid number of arguments. Please supply project-config.json as argument"
        )
    with open(sys.argv[1]) as f:
        config = json.load(f)

    # converting to absolute path to avoid ambiguities later.
    config["OutputDirectory"] = os.path.join(os.getcwd(), config["OutputDirectory"])

    print("🎯 Dealing with Geomety data")

    stdout = io.StringIO()

    if config.get("ABCFilePath", None):
        print("🚧 Obtained ABC File")

        # https://blender.stackexchange.com/a/220016/165060
        while bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[0], do_unlink=True)

        # import the ABC file
        bpy.ops.wm.alembic_import(filepath=config["ABCFilePath"])

        # get the number of frames in the ABC file
        frame_start = bpy.context.scene.frame_start
        frame_end = bpy.context.scene.frame_end
        os.makedirs(os.path.join(config["OutputDirectory"], "OBJ"), exist_ok=True)

        progress_bar = tqdm(range(frame_start, frame_end + 1))
        for frame in progress_bar:
            # set the current frame
            bpy.context.scene.frame_set(frame)
            # generate the output file path
            output_path = os.path.join(
                config["OutputDirectory"], "OBJ", f"frame_{frame:05}.obj"
            )

            progress_bar.set_description(f"🔍 Extracting frame {frame}")
            with redirect_stdout(stdout):
                # export the current frame as an OBJ file
                # by silencing the output
                bpy.ops.export_scene.obj(filepath=output_path, use_selection=True)

        config["OBJFilesPath"] = os.path.join(config["OutputDirectory"], "OBJ", "frame_#####.obj")

    if config.get("OBJFilesPath", None):
        print("🚧 Obtained OBJ files path")

        directory, pattern = os.path.split(config["OBJFilesPath"])
        obj_files = sorted([file for file in os.listdir(directory) if file.endswith('obj')])
        os.makedirs(os.path.join(config["OutputDirectory"], "DRC"), exist_ok=True)
        config["DRACOFilesPath"] = os.path.join(config["OutputDirectory"], "DRC", pattern + '.drc')

        progress_bar = tqdm(obj_files)
        frame_index = 0
        for file in progress_bar:
            progress_bar.set_description(f'📦 Compressing frame {frame_index}')
            command = f'draco_encoder -i "{os.path.join(directory, file)}" -o "{os.path.join(config["OutputDirectory"], "DRC", file + ".drc")}" -qp {config.get("Q_POSITION_ATTR", 11)} -qt {config.get("Q_TEXTURE_ATTR", 10)} -qn {config.get("Q_NORMAL_ATTR", 8)} -qg {config.get("Q_GENERIC_ATTR", 8)} -cl {config.get("DRACO_COMPRESSION_LEVEL", 7)}'
            args = shlex.split(command)
            rc = subprocess.call(args, stdout=subprocess.DEVNULL)
            if rc:
                print(f'Failed to compress {file}')
                exit(1)
            frame_index += 1

        

    if config.get("DRACOFilesPath", None):
        print("✅ Obtained DRACO files")

    print("🎯 Dealing with Texture data")
    if config.get("ImagesPath", None):
        if "%" not in config["ImagesPath"]:
            print(
                "❌ ImagesPath must be printf() format string to compose multiple filenames"
            )
            exit(1)
        print("🚧 Obtained Images path.")
        current_file_index = config["KTX2_FIRST_FILE"]
        os.makedirs(os.path.join(config["OutputDirectory"], "KTX2"), exist_ok=True)

        progress_bar = tqdm(range(config["KTX2_FIRST_FILE"], config["KTX2_FILE_COUNT"], config["KTX2_BATCH_SIZE"]))
        for current_file_index in progress_bar:
            progress_bar.set_description(f'📦 Compressing images from {current_file_index} to {current_file_index + config["KTX2_BATCH_SIZE"] - 1}')
            command = f'basisu -ktx2 -tex_type video -multifile_printf "{config["ImagesPath"]}" -multifile_num {config["KTX2_BATCH_SIZE"]} -multifile_first {config["KTX2_FIRST_FILE"]} -y_flip -output_file "{os.path.join(config["OutputDirectory"], "KTX2", "texture_%05u"%(current_file_index//config["KTX2_BATCH_SIZE"]))}.ktx2"'
            args = shlex.split(command)
            rc = subprocess.call(args, stdout=subprocess.DEVNULL)
            if rc:
                print(f'Failed to compress images with indices: [{current_file_index}, {current_file_index + config["KTX2_BATCH_SIZE"]}]')
                exit(1)

            
        config["KTX2FilesPath"] = os.path.join(config["OutputDirectory"], "KTX2")

    if config["KTX2FilesPath"]:
        print("✅ Obtained KTX2 files")

    manifestData = {
        "DRCURLPattern": config["DRACOFilesPath"],
        "KTX2URLPattern": config["KTX2FilesPath"],
        "BatchSize": config["KTX2_BATCH_SIZE"],
        "TotalFrames": len(os.listdir(os.path.split(config["DRACOFilesPath"])[0])),
        "FrameRate": config["FRAME_RATE"],
    }
    if config.get("AudioURL", None):
        manifestData["AudioURL"] = config["AudioPath"]

    manifest_path = os.path.join(
        config["OutputDirectory"], config["name"] + ".manifest"
    )

    with open(manifest_path, "w") as f:
        json.dump(manifestData, f)
    print(f"✅ Written Manifest file: {manifest_path}")


if __name__ == "__main__":
    main()
