import os
import bpy
import sys

# get the path to the ABC file and the output directory from command line arguments
abc_path = sys.argv[1]
output_dir = sys.argv[2]

# https://blender.stackexchange.com/a/220016/165060
while bpy.data.objects:
    bpy.data.objects.remove(bpy.data.objects[0], do_unlink=True)

# import the ABC file
bpy.ops.wm.alembic_import(filepath=abc_path)

# get the number of frames in the ABC file
frame_start = bpy.context.scene.frame_start
frame_end = bpy.context.scene.frame_end

# loop through each frame and export it as a separate OBJ file
for frame in range(frame_start, frame_end + 1):
    # set the current frame
    bpy.context.scene.frame_set(frame)
    # generate the output file path
    output_path = os.path.join(output_dir, f'frame_{frame:04}.obj')
    # export the current frame as an OBJ file
    bpy.ops.export_scene.obj(filepath=output_path, use_selection=True)
