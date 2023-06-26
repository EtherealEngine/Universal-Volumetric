import rich
from rich.pretty import pprint
from rich.spinner import Spinner
from shutil import which
import sys
import json
from rich.live import Live
from rich.progress import track
import bpy
import os
import subprocess
import shlex
from types import SimpleNamespace


def check_executables():
    ok = True
    if not which("draco_encoder"):
        pprint(
            "❌ 'draco_encoder' command doesn't exist. Please build it from https://github.com/google/draco"
        )
        ok = False
    if not which("basisu"):
        pprint(
            "❌ 'basisu' command doesn't exist. Please build it from https://github.com/BinomialLLC/basis_universal"
        )
        ok = False
    if not ok:
        exit(1)


def main():
    check_executables()
    if len(sys.argv) != 2:
        pprint(
            "❌ Invalid number of arguments. Please supply project-config.json as argument"
        )
    with open(sys.argv[1]) as f:
        config = SimpleNamespace(**json.load(f))

    # converting to absolute path to avoid ambiguities later.
    config.OutputDirectory = os.path.join(os.getcwd(), config.OutputDirectory)

    if config.ABCFilesPath:
        print("- Obtained ABC File")

        # https://blender.stackexchange.com/a/220016/165060
        while bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[0], do_unlink=True)

        # import the ABC file
        bpy.ops.wm.alembic_import(filepath=config.ABCFilesPath)

        # get the number of frames in the ABC file
        frame_start = bpy.context.scene.frame_start
        frame_end = bpy.context.scene.frame_end
        os.makedirs(os.path.join(config.OutputDirectory, "OBJ"), exist_ok=True)

        for frame in track(
            range(frame_start, frame_end + 1), description="Extracting Frames..."
        ):
            # set the current frame
            bpy.context.scene.frame_set(frame)
            # generate the output file path
            output_path = os.path.join(
                config.OutputDirectory, "OBJ", f"frame_{frame:04}.obj"
            )
            # export the current frame as an OBJ file
            bpy.ops.export_scene.obj(filepath=output_path, use_selection=True)

        config.OBJFilesPath = os.path.join(config.OutputDirectory, "OBJ")

    if config.OBJFilesPath:
        print("- Obtained OBJ files path, Compressing them to DRACO files...")
        obj_files = sorted(os.listdir(config.OBJFilesPath))

        config.Q_POSITION_ATTR = config.Q_POSITION_ATTR or 11
        config.Q_TEXTURE_ATTR = config.Q_TEXTURE_ATTR or 10
        config.Q_NORMAL_ATTR = config.Q_NORMAL_ATTR or 8
        config.Q_GENERIC_ATTR = config.Q_GENERIC_ATTR or 8
        config.DRACO_COMPRESSION_LEVEL = config.DRACO_COMPRESSION_LEVEL or 7

        os.makedirs(os.path.join(config.OutputDirectory, "DRC"), exist_ok=True)

        for file in track(obj_files, description="Compressing to DRC..."):
            command = f'draco_encoder -i {os.path.join(config.OBJFilesPath, file)} -o {os.path.join(config.OutputDirectory, "DRC", file + ".drc")} -qp {config.Q_POSITION_ATTR} -qt {config.Q_TEXTURE_ATTR} -qn {config.Q_NORMAL_ATTR} -qg {config.Q_GENERIC_ATTR} -cl {config.DRACO_COMPRESSION_LEVEL}'
            args = shlex.split(command)
            subprocess.call(args, stdout=subprocess.DEVNULL)

        config.DRACOFilesPath = os.path.join(config.OutputDirectory, "DRC")

    if config.DRACOFilesPath:
        print("✅ Obtained DRACO files")

    if config.IMAGES_PATH:
        if "%" not in config.IMAGES_PATH:
            pprint(
                "❌ IMAGES_PATH must be printf() format string to compose multiple filenames"
            )
            exit(1)
        pprint("- Obtained Images path.")
        current_file_index = config.KTX2_FIRST_FILE
        os.makedirs(os.path.join(config.OutputDirectory, "KTX2"), exist_ok=True)

        for current_file_index in track(
            range(
                config.KTX2_FIRST_FILE,
                config.KTX2_FILE_COUNT,
                config.KTX2_BATCH_SIZE,
            ),
            description="Compressing images to ktx2...",
        ):
            command = f'basisu -ktx2 -tex_type video -multifile_printf "{config.IMAGES_PATH}" -multifile_num {config.KTX2_BATCH_SIZE} -multifile_first {config.KTX2_FIRST_FILE} -y_flip -output_file "{os.path.join(config.OutputDirectory, "KTX2", "texture_%05u"%(current_file_index//config.KTX2_BATCH_SIZE))}.ktx2"'
            args = shlex.split(command)
            subprocess.call(args, stdout=subprocess.DEVNULL)
        config.KTX2FilesPath = os.path.join(config.OutputDirectory, "KTX2")

    if config.KTX2FilesPath:
        print("✅ Obtained KTX2 files")

    manifestData = {
        "DRCURLPattern": config.DRACOFilesPath,
        "KTX2URLPattern": config.KTX2FilesPath,
        "AudioURL": config.AudioPath,
        "BatchSize": config.KTX2_BATCH_SIZE,
        "TotalFrames": len(os.listdir(config.DRACOFilesPath)),
        "FrameRate": config.FRAME_RATE,
    }
    manifest_path = os.path.join(config.OutputDirectory, config.name + ".manifest")

    with open(manifest_path, "w") as f:
        json.dump(manifestData, f)
    pprint(f"✅ Written Manifest file: {manifest_path}")


if __name__ == "__main__":
    main()
