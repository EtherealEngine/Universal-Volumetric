from shutil import which
import sys
import json
import bpy
import os
import subprocess
import shlex
from tqdm import tqdm


import io
from contextlib import redirect_stdout
import struct
import audioread


def convert_pounds_to_c_style(s):
    # export_#####.png => export_%05u.png
    pound_count = s.count("#")
    return s.replace("#" * pound_count, f"%0{pound_count}u")


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


def check_all_fields(config):
    mandatory_fields = [
        "name",
        "GEOMETRY_FRAME_RATE",
        "TEXTURE_FRAME_RATE",
        "OutputDirectory",
        "KTX2_BATCH_SIZE",
    ]

    missing_fields = []
    for key in mandatory_fields:
        if config.get(key) is None:
            missing_fields.append(key)
    if missing_fields:
        print("❌ Missing mandatory fields: ", missing_fields)
        exit(1)

    if (
        config.get("ABCFilePath")
        or config.get("OBJFilesPath")
        or config.get("DRACOFilesPath")
    ):
        pass
    else:
        print("❌ Path to Geometry data is not specified")
        exit(1)

    if config.get("ImagesPath"):
        if config.get("KTX2_FIRST_FILE") and config.get("KTX2_FILE_COUNT"):
            pass
        else:
            print(
                "❌ When ImagesPath is given, you must specify `KTX2_FIRST_FILE` and `KTX2_FILE_COUNT`"
            )
            exit(1)
    elif config.get("KTX2FilesPath"):
        pass
    else:
        print("❌ Path to Texture data is not specified")
        exit(1)


def match_pattern(pattern, file_name):
    # Assumes pattern contains seven pound characters (#)
    # Implying file name indices are padded with atmost 7 zeroes. Eg: 0000001
    PAD_STRING = "#######"
    PAD_LENGTH = len(PAD_STRING)
    pad_index = pattern.find(PAD_STRING)
    if (
        (pattern[:pad_index] == file_name[:pad_index])
        and (pattern[pad_index + PAD_LENGTH :] == file_name[pad_index + PAD_LENGTH :])
        and file_name[pad_index : pad_index + PAD_LENGTH].isdigit()
    ):
        return True
    return False


def check_total_frames(config):
    """
    Checks whether the combination of geometry frames,
    texture frames and their corresponding frame rates
    are compatible
    """
    drc_directory, drc_pattern = os.path.split(config["DRACOFilesPath"])
    geometry_frame_count = len(
        [file for file in os.listdir(drc_directory) if match_pattern(drc_pattern, file)]
    )

    ktx2_directory, ktx2_pattern = os.path.split(config["KTX2FilesPath"])
    texture_segments = sorted(
        [
            file
            for file in os.listdir(ktx2_directory)
            if match_pattern(ktx2_pattern, file)
        ]
    )

    # not including last segments count because, it might not be full segment
    texture_frame_count = (len(texture_segments) - 1) * config["KTX2_BATCH_SIZE"]
    with open(os.path.join(ktx2_directory, texture_segments[-1]), "rb") as f:
        last_segment = f.read()

    # Extracting layerCount according to KTX2 spec: https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html
    last_segment_frame_count = struct.unpack("<I", last_segment[32:36])[0]
    texture_frame_count += last_segment_frame_count

    print(f"Geometry frame count: {geometry_frame_count}")
    print(f"Texture frame count (not segments): {texture_frame_count}")

    if (geometry_frame_count * config["TEXTURE_FRAME_RATE"]) != (
        texture_frame_count * config["GEOMETRY_FRAME_RATE"]
    ):
        print(
            "❌ Number of Geometry frames and Texture frames are not compatible with the given frame rates"
        )
        print("Ignore and proceed? (y/n): ", end="")
        choice = input()
        if choice == "y":
            pass
        else:
            exit(1)

    uvol_durations = {
        "geometry": geometry_frame_count / config["GEOMETRY_FRAME_RATE"],
        "texture": texture_frame_count / config["TEXTURE_FRAME_RATE"],
    }
    return uvol_durations, geometry_frame_count, len(texture_segments)


def main():
    if len(sys.argv) != 2:
        print(
            "❌ Invalid number of arguments. Please supply project-config.json as argument"
        )

    if sys.argv[1] == "create-template":
        template_data_str = """{
  "name": "",
  "ABCFilePath": "",
  "OBJFilesPath": "", // pattern with hashes. eg: OBJ/frame_###.obj
  "DRACOFilesPath": "", // pattern with hashes
  "Q_POSITION_ATTR": 11, // quantization bits for the position attribute, default=11.
  "Q_TEXTURE_ATTR": 10, // quantization bits for the texture coordinate attribute, default=10.
  "Q_NORMAL_ATTR": 8, // quantization bits for the normal vector attribute, default=8.
  "Q_GENERIC_ATTR": 8, // quantization bits for any generic attribute, default=8.
  "DRACO_COMPRESSION_LEVEL": 7, // compression level [0-10], most=10, least=0, default=7.
  "ImagesPath": "", // pattern with hashes.
  "KTX2_FIRST_FILE": 0, // The index of the first file in above pattern. Eg: If PNG/frame_001.png is first texture, this field should be 1
  "KTX2_FILE_COUNT": 0,
  "KTX2_BATCH_SIZE": 7,
  "KTX2FilesPath": "",
  "GEOMETRY_FRAME_RATE": 30,
  "TEXTURE_FRAME_RATE": 30,
  "OutputDirectory": ""
}
"""
        with open("project-config-template.json", "w") as f:
            print(template_data_str, file=f)
        print("✅ Written template object to project-config-template.json")
        print(
            "The config file contains comments indicating extra info about fields. Encoder removes comments while parsing it, so you can leave them or add new comments"
        )
        return

    check_executables()

    with open(sys.argv[1]) as f:
        config = json.load(f)

    check_all_fields(config)

    # converting to absolute path to avoid ambiguities later.
    config["OutputDirectory"] = os.path.join(os.getcwd(), config["OutputDirectory"])

    print("🎯 Dealing with Geomety data")

    stdout = io.StringIO()

    if config.get("ABCFilePath", None):
        print("🚧 Obtained ABC File")

        # https://blender.stackexchange.com/a/220016/165060
        # removes the default cube and cone in scene
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
                config["OutputDirectory"], "OBJ", f"frame_{frame:07}.obj"
            )

            progress_bar.set_description(f"🔍 Extracting frame {frame}")
            with redirect_stdout(stdout):
                # export the current frame as an OBJ file
                # by silencing the output
                bpy.ops.export_scene.obj(filepath=output_path, use_selection=True)

        config["OBJFilesPath"] = os.path.join(
            config["OutputDirectory"], "OBJ", "frame_#####.obj"
        )

    if config.get("OBJFilesPath", None):
        print("🚧 Obtained OBJ files path")

        directory, pattern = os.path.split(config["OBJFilesPath"])
        obj_files = sorted(
            [file for file in os.listdir(directory) if file.endswith("obj")]
        )
        os.makedirs(os.path.join(config["OutputDirectory"], "DRC"), exist_ok=True)
        config["DRACOFilesPath"] = os.path.join(
            config["OutputDirectory"], "DRC", pattern + ".drc"
        )

        progress_bar = tqdm(obj_files)
        frame_index = 0
        for file in progress_bar:
            progress_bar.set_description(f"📦 Compressing frame {frame_index}")
            command = f'draco_encoder -i "{os.path.join(directory, file)}" -o "{os.path.join(config["OutputDirectory"], "DRC", file + ".drc")}" -qp {config.get("Q_POSITION_ATTR", 11)} -qt {config.get("Q_TEXTURE_ATTR", 10)} -qn {config.get("Q_NORMAL_ATTR", 8)} -qg {config.get("Q_GENERIC_ATTR", 8)} -cl {config.get("DRACO_COMPRESSION_LEVEL", 7)}'
            args = shlex.split(command)
            rc = subprocess.call(args, stdout=subprocess.DEVNULL)
            if rc:
                print(f"Failed to compress {file}")
                print("Command: ", command)
                exit(1)
            frame_index += 1

    if config.get("DRACOFilesPath", None):
        print("✅ Obtained DRACO files")

    print("🎯 Dealing with Texture data")
    if config.get("ImagesPath", None):
        config["ImagesPath"] = convert_pounds_to_c_style(config["ImagesPath"])
        print("🚧 Obtained Images path.")
        current_file_index = config["KTX2_FIRST_FILE"]
        os.makedirs(os.path.join(config["OutputDirectory"], "KTX2"), exist_ok=True)

        progress_bar = tqdm(
            range(
                config["KTX2_FIRST_FILE"],
                config["KTX2_FILE_COUNT"],
                config["KTX2_BATCH_SIZE"],
            )
        )
        for current_file_index in progress_bar:
            progress_bar.set_description(
                f'📦 Compressing images from {current_file_index} to {current_file_index + config["KTX2_BATCH_SIZE"] - 1}'
            )
            command = f'basisu -ktx2 -tex_type video -multifile_printf "{config["ImagesPath"]}" -multifile_num {config["KTX2_BATCH_SIZE"]} -multifile_first {config["KTX2_FIRST_FILE"]} -y_flip -output_file "{os.path.join(config["OutputDirectory"], "KTX2", "texture_%07u"%(current_file_index//config["KTX2_BATCH_SIZE"]))}.ktx2"'
            args = shlex.split(command)
            rc = subprocess.call(args, stdout=subprocess.DEVNULL)
            if rc:
                print(
                    f'Failed to compress images with indices: [{current_file_index}, {current_file_index + config["KTX2_BATCH_SIZE"]}]'
                )
                print("Command: ", command)
                exit(1)

        config["KTX2FilesPath"] = os.path.join(config["OutputDirectory"], "KTX2")

    if config["KTX2FilesPath"]:
        print("✅ Obtained KTX2 files")

    uvol_durations, geometry_frame_count, texture_segment_count = check_total_frames(
        config
    )
    print("✅ Frames and frame rates are compatible")

    manifestData = {
        "DRCURLPattern": os.path.relpath(
            config["DRACOFilesPath"], config["OutputDirectory"]
        ),
        "KTX2URLPattern": os.path.relpath(
            config["KTX2FilesPath"], config["OutputDirectory"]
        ),
        "BatchSize": config["KTX2_BATCH_SIZE"],
        "GeometryFrameCount": geometry_frame_count,
        "TextureSegmentCount": texture_segment_count,
        "GeometryFrameRate": config["GEOMETRY_FRAME_RATE"],
        "TextureFrameRate": config["TEXTURE_FRAME_RATE"],
    }

    # if audio duration is compatible with frames and frame rates
    if config.get("AudioURL", None):
        with audioread.audio_open(config["AudioURL"]) as f:
            audio_duration = f.duration  # in seconds
        if (
            uvol_durations["geometry"] == audio_duration
            and uvol_durations["texture"] == audio_duration
        ):
            print("✅ Audio duration matches with the frame count and frame rates")
        else:
            print("❌ Audio duration doesn't match with the frame count and frame rates")
            print(f"UVOL durations (without audio): ", uvol_durations)
            print(f"Audio duration: {audio_duration}")
            print("Ignore and proceed? (y/n): ", end="")
            choice = input()
            if choice == "y":
                pass
            else:
                exit(1)

        manifestData["AudioURL"] = config["AudioPath"]
    else:
        print("💡 Audio file not supplied, Skipping duration check...")

    if config.get("AudioURL", None):
        manifestData["AudioURL"] = config["AudioPath"]

    manifest_path = os.path.join(
        config["OutputDirectory"], config["name"] + ".manifest"
    )

    with open(manifest_path, "w") as f:
        json.dump(manifestData, f)
    print(f"✅ Written Manifest file: {manifest_path}.")
    print(
        f"💡 Tip: If you're moving the manifest file, move the DRACO and KTX2 directories along with it, because, they're relative paths"
    )

    if ((config["GEOMETRY_FRAME_RATE"] % config["TEXTURE_FRAME_RATE"]) != 0) and (
        (config["TEXTURE_FRAME_RATE"] % config["GEOMETRY_FRAME_RATE"]) != 0
    ):
        print(
            "⚠️ Warning: Frame rates are not factors of one another. Ambiguities may arise when calulating appropriate texture for geometry frames."
        )


if __name__ == "__main__":
    main()
