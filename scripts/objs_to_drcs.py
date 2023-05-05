import bpy
import os

folder_path = "/path/to/folder"

# Iterate through the files in the folder
for file_name in os.listdir(folder_path):
    if file_name.endswith(".obj"):
        # Construct the full file path
        file_path = os.path.join(folder_path, file_name)

        # Import the .obj file
        bpy.ops.import_scene.obj(filepath=file_path)

        # Export the imported mesh to .drc
        drc_file_path = file_path[:-4] + ".drc"
        bpy.ops.export_mesh.drc(filepath=drc_file_path)

        # Clear the imported mesh from the scene
        bpy.ops.object.select_all(action='DESELECT')
        bpy.ops.object.select_by_type(type='MESH')
        bpy.ops.object.delete()