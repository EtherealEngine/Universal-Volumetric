import bpy
import sys

# get the path to the ABC file and the output directory from command line arguments
abc_path = sys.argv[5]
output_dir = sys.argv[6]

# import the ABC file
bpy.ops.wm.alembic_import(filepath=abc_path)

# get the number of frames in the ABC file
frame_start = bpy.context.scene.frame_start
frame_end = bpy.context.scene.frame_end

# loop through each frame and export it as a separate OBJ file
for frame in range(frame_start, frame_end+1):
    # set the current frame
    bpy.context.scene.frame_set(frame)
    # generate the output file path
    output_path = f"{output_dir}/frame_{frame:04}.obj"
    # export the current frame as an OBJ file
    bpy.ops.export_scene.obj(filepath=output_path, use_selection=True)
    