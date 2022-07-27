import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import os
import copy
from plyfile import PlyData, PlyElement
import json
from numpy.lib.recfunctions import merge_arrays
import pyprogmesh
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import warnings
warnings.simplefilter('ignore', np.RankWarning)

dirname = os.path.dirname(__file__)

decimation_amount = .25 # Decimation percentage

_current_keyframe = 0
# If a mesh doesn't have multiple corresponding frames to make a fit from, don't encode additional vertex data
_short_data_type = [('x', '<f4'), ('y', '<f4'), ('z', '<f4'), ('texture_u', '<f4'), ('texture_v', '<f4')]
# If a mesh has multiple coherent frames, encode additional vertex data
_full_data_type = [('x', '<f4'), ('y', '<f4'), ('z', '<f4'), ('texture_u', '<f4'), ('texture_v', '<f4'), ('x0', '<f4'), ('x1', '<f4'), ('x2', '<f4'), ('x3', '<f4'), ('y0', '<f4'), ('y1', '<f4'), ('y2', '<f4'), ('y3', '<f4'), ('z0', '<f4'), ('z1', '<f4'), ('z2', '<f4'), ('z3', '<f4')]


#======================================================================================================================
#--------------------------------------------- MAIN Function ----------------------------------------------------------
#======================================================================================================================

def main():
    frame_number = 0
    vertex_count_in_last_ply = 0
    meshes_in_group = []

    Data_Path = dirname + "/output_ply_face_uvs"
    # Data_Path = dirname + "/encode"

    # Exception Handling : If 'encode' folder is not there, create one
    assert os.path.exists(Data_Path), 'The Dataset Folder not found. Please consider giving full(absolute) file path.'

    for files in os.listdir(Data_Path):
        if files.endswith(".ply"): # Exception Handling

            mesh = PlyData.read(Data_Path + '/' + files)
            print(len(mesh['vertex']['x']))
            
            if (frame_number > 0 and len(mesh['vertex']['x']) != vertex_count_in_last_ply):
                print("New Shape at Frame " + str(frame_number))
                create_poly_mesh_from_sequence(meshes_in_group)
                meshes_in_group = [mesh]
            else:
                meshes_in_group.append(mesh)
                print("Adding mesh " +  str(frame_number+1) + " to group")

            frame_number = frame_number + 1
            _current_keyframe = frame_number
            vertex_count_in_last_ply = len(mesh['vertex']['x']) # set new vertex count

    create_poly_mesh_from_sequence(meshes_in_group)

#======================================================================================================================


def create_poly_mesh_from_sequence(meshes):
    # Is it a sequence of meshes or a single mesh? Skip the fit algorithm for single meshes
    is_sequence = len(meshes) > 1
    # Count the number of 'x' entries in the first mesh, assuming all meshes have the same count and xyz are the same
    number_of_vertices = len(meshes[0]['vertex']['x'])

    # Input vertices from first frame
    input_vertices = meshes[0].elements[0]
    # Input faces from first frame
    input_faces = meshes[0].elements[1]

    encoded_vertices_transposed = []

    if(is_sequence == True):
        for mesh in range(len(meshes)):
            for v in ['x', 'y', 'z']:
                for vert in range(min(len(meshes[mesh].elements[0].data[v]), len(meshes[0].elements[0].data[v]))):
                    # offset meshes so first mesh is always 0 vals
                    meshes[mesh].elements[0].data[v][vert] = meshes[mesh].elements[0].data[v][vert] - meshes[0].elements[0].data[v][vert]
            # For all meshes in group, subtract position from self and add to offset mesh group

        # Array of polynomial data we will append to vertices later
        polynomial_array = []

        # for each vert in our meshes...
        for current_vertex in range(number_of_vertices):
            # print("\nNew Vertex\n")
            # get an axis
            polyAxes = []
            # for each in xyz
            for axis in ['x', 'y', 'z']:
                # new array of vertex positions
                vertex_positions = []
                # Frame list encodes a single integer for each mesh in the sequence, to give polyfit a second dimension
                frame_list = []
                # Will be incremented with each frame processed and add to frame list
                current_frame = 0
                # for each mesh in count
                for m in range(len(meshes)):
                    # Add the mesh number, with the first mesh in this sequence being 0
                    frame_list.append(current_frame)
                    # Increment the current frame
                    current_frame = current_frame + 1
                    # add the normalized 
                    # vertex_positions.append(meshes[m]['vertex'][axis][current_vertex] - meshes[0]['vertex'][axis][current_vertex])
                    vertex_positions.append(meshes[m]['vertex'][axis][current_vertex])
                # model = polyfit
                # print('\nFrames List :', frame_list, '\nVertex Positions :', vertex_positions)
                model = np.polyfit(frame_list, vertex_positions, 4)
                # Add the model data. We are removing the last term, which will always be 0 on a normalized trajectory
                polyAxes.append( model[:-1] )
            # append the output to our array of outputs, polynomial_array[v] corresponds with meshes[0]['vertex'][axis][v]
            polynomial_array.append(polyAxes)

        # Make a new list to hold our encoded vertices
        encoded_vertices = []

        # Convert the polynomial array to a numpy format we can reason and combine with original vertex data
        # This could probably be greatly simplified, since we are trying to make an x, y and z array into a single array of xyz
        # for each vertex in the polynomial array
        for v in range(len(polynomial_array)):
            # New encoded vertex, with polynomials stored for xyz
            encoded_vertex = []
            # Append all vertex data for this vertex
            for val in input_vertices[v]:
                encoded_vertex.append(val)
            # Traverse xyz axes in this vertex
            for a in range(len(polynomial_array[v])):
                # Traverse polynomial terms
                for n in range(len(polynomial_array[v][a])):
                    # Append polynomial terms to the vertex in XYZ order
                    encoded_vertex.append(polynomial_array[v][a][n])
            # Convert list to np array and add to list of encoded vertices
            encoded_vertices.append(np.array(encoded_vertex))
        #Transpose encoded vertices so rows are columns and we are writing rows
        encoded_vertices_transposed = np.array(encoded_vertices).T

    # Create an array for our final vertices
    vertices = np.empty(number_of_vertices, dtype=(_short_data_type if is_sequence != True else _full_data_type))

    # Populate with original data
    vertices['x'] = meshes[0]['vertex']['x'].astype('f4')
    vertices['y'] = meshes[0]['vertex']['y'].astype('f4')
    vertices['z'] = meshes[0]['vertex']['z'].astype('f4')
    vertices['texture_u'] = meshes[0]['vertex']['texture_u'].astype('f4')
    vertices['texture_v'] = meshes[0]['vertex']['texture_v'].astype('f4')

    # If this mesh is a sequence, write the data into our vertices array
    if(is_sequence == True):
        vertices['x0'] = encoded_vertices_transposed[5].astype('f4')
        vertices['x1'] = encoded_vertices_transposed[6].astype('f4')
        vertices['x2'] = encoded_vertices_transposed[7].astype('f4')
        vertices['x3'] = encoded_vertices_transposed[8].astype('f4')
        vertices['y0'] = encoded_vertices_transposed[9].astype('f4')
        vertices['y1'] = encoded_vertices_transposed[10].astype('f4')
        vertices['y2'] = encoded_vertices_transposed[11].astype('f4')
        vertices['y3'] = encoded_vertices_transposed[12].astype('f4')
        vertices['z0'] = encoded_vertices_transposed[13].astype('f4')
        vertices['z1'] = encoded_vertices_transposed[14].astype('f4')
        vertices['z2'] = encoded_vertices_transposed[15].astype('f4')
        vertices['z3'] = encoded_vertices_transposed[16].astype('f4')

    # Exception handling
    if(os.path.exists(dirname + "/encoded") == False):
        print('The "encoded" folder not found. Creating a new one..', end = '')
        os.mkdir(dirname + "/encoded"); print('Done')

    # Write the py file
    poly_mesh_path = (dirname + "/encoded/" + str(_current_keyframe) + '.ply')
    ply = PlyData([PlyElement.describe(vertices, 'vertex'), input_faces], text=True)
    ply.write(poly_mesh_path)

    # Chain the decimation on to the end
    decimate_mesh(poly_mesh_path, decimation_amount, is_sequence)

#======================================================================================================================


def decimate_mesh(poly_mesh_path, decimate_amount, is_sequence):

    # Empty objects
    new_verts = list()
    faces = list()

    # Create a new mesh object
    decimatedMesh = Mesh()

    # Progressive Mesh decimation settings
    PMSettings = pyprogmesh.ProgMeshSettings()
    PMSettings.ProtectTexture = True
    PMSettings.RemoveDuplicate = False
    PMSettings.KeepBorder = True

    # Read mesh from path
    mesh = PlyData.read(poly_mesh_path)
    # print(mesh['vertex']['x'])
 

    # Get number of vertices in mesh
    number_of_vertices = len(mesh['vertex']['x']) #14
    # Get x, y and z data in mesh
    (x, y, z) = (mesh['vertex'][t] for t in ('x', 'y', 'z'))

    # Extract vertices from x, y and z columns into a single xyz column and append to decimated mesh
    for i in range(number_of_vertices):
        vertex = Vertex() # 'Vertex' class object
        vertex.x = x[i]
        vertex.y = y[i]
        vertex.z = z[i]
        decimatedMesh.vertices.append(vertex) # append vertex object


    for i in range(number_of_vertices): # 14
        v = [decimatedMesh.vertices[i].x, decimatedMesh.vertices[i].y, decimatedMesh.vertices[i].z]
        _uv = [mesh['vertex']['texture_u'][i], mesh['vertex']['texture_v'][i]]
        # print('\nUV :', _uv, '\n')
        # if mesh.has_normals:
        #     _normal = [mesh.normals[i].x, mesh.normals[i].y, mesh.normals[i].z]
        # else:
        _normal = None 
        new_verts.append(pyprogmesh.RawVertex(Position=v, UV=_uv, Normal=_normal, RGBA=None))
    #HANDLE FACES

    # For each in vertex indicies
    # Create a new face
    # populate with v_1, v_2, v_3
    # append to face list
    decimatedMesh.faces = []
    for i in range(0, mesh.elements[1].count):
        face = Face()
        face.v_1 = mesh['face'].data['vertex_indices'][i][0]
        face.v_2 = mesh['face'].data['vertex_indices'][i][1]
        face.v_3 = mesh['face'].data['vertex_indices'][i][2]
        # Append to decimated mesh face count
        decimatedMesh.faces.append(face)

    # Rename values and add to faces list
    # Probably could combine this with our decimated mesh faces
    for i in range(0, mesh.elements[1].count):
        faces.append([decimatedMesh.faces[i].v_1, decimatedMesh.faces[i].v_2, decimatedMesh.faces[i].v_3])

    # Create a new progressive mesh object
    pm = pyprogmesh.ProgMesh(len(new_verts), len(faces), new_verts, faces, PMSettings)
    # Compute the mesh decimate
    pm.ComputeProgressiveMesh()
    # Perform decimation and return mesh data
    result = pm.DoProgressiveMesh(decimate_amount)
    # If result is 0 then the collapse didn't work, and code past this point will fail
    if(result == 0):
        print("*** Error collapsing mesh")
        return
    
    decimatedMesh.num_vertices, decimatedMesh.vertices, decimatedMesh.num_faces, decimatedMesh.faces, decimatedMesh.collapse_map = result[0], result[1], result[2], result[3], result[4]
    
    # Some empty lists to hold data
    output_vertices = []
    newUVs = []
    newNormals = []

    # For each vertex, pull out the information and rename the variables
    for i in range(0, decimatedMesh.num_vertices):
        rawVert = new_verts[i]
        v = Vertex()
        v.x = rawVert.Position[0]
        v.y = rawVert.Position[1]
        v.z = rawVert.Position[2]
        # Not sure if we need this
        # if decimatedMesh.num_uv_sets > 0:
        #     uv = decimatedMesh.uv_sets[0][i]
        #     uv.u = rawVert.UV[0]
        #     uv.v = rawVert.UV[1]
        #     newUVs.append(uv)
        # if decimatedMesh.has_normals:
        #     normals = decimatedMesh.normals[i]
        #     normals.x = rawVert.Normal[0]
        #     normals.y = rawVert.Normal[1]
        #     normals.z = rawVert.Normal[2]
        #     newNormals.append(normals)
        # Append the vertex to our list
        output_vertices.append(v)
    # Set vertices, so not we have xyz instead of a position[] array
    decimatedMesh.vertices = output_vertices
    # These are blank for now but will need to be handled
    decimatedMesh.normals = newNormals
    decimatedMesh.uv_sets = newUVs

    # Same thing for the faces -- restructure with new names
    outFaces = []
    # For each face, rename and reassign
    # This might be something we can remove completely
    for i in range(0, decimatedMesh.num_faces):
        triangle = decimatedMesh.faces[i]
        t = Face()
        t.v_1 = triangle[0]
        t.v_2 = triangle[1]
        t.v_3 = triangle[2]
        outFaces.append(t)
    
    # Set decimated mesh faces to newly structured faces
    decimatedMesh.faces = outFaces

    # Make a new empty container for our final output vertices
    output_vertices = np.empty(len(decimatedMesh.vertices), dtype=(_short_data_type if is_sequence != True else _full_data_type))

    # Hold the length of the decimated mesh
    decimated_mesh_length = len(decimatedMesh.vertices)

    # Fill vertex values with their original values, albeit truncated
    output_vertices['x'] = mesh['vertex']['x'][0:decimated_mesh_length].astype('f4')
    output_vertices['y'] = mesh['vertex']['y'][0:decimated_mesh_length].astype('f4')
    output_vertices['z'] = mesh['vertex']['z'][0:decimated_mesh_length].astype('f4')

    print("**** COLLAPSE MAP VALUE")
    print(decimatedMesh.collapse_map)
    # Now iterate through and fill them with the proper values
    # for i in range(0, len(decimatedMesh.collapse_map)):
    for i in range(3):
        # Look up old index
        # Since we don't have the new index, this is almost certain wrong, unless collapse map is the same value
        old_index = decimatedMesh.collapse_map[i]
        if(old_index == -1):
            old_index = i
        output_vertices[i]['x'] = mesh['vertex']['x'][old_index].astype('f4')
        output_vertices[i]['y'] = mesh['vertex']['y'][old_index].astype('f4')
        output_vertices[i]['z'] = mesh['vertex']['z'][old_index].astype('f4')
        output_vertices['texture_u'] = mesh['vertex']['texture_u'][old_index].astype('f4')
        output_vertices['texture_v'] = mesh['vertex']['texture_v'][old_index].astype('f4')   
        # Add additional vertex data if it's a sequence
        if(is_sequence):
            output_vertices[i]['x0'] = mesh['vertex']['x0'][old_index].astype('f4')
            output_vertices[i]['x1'] = mesh['vertex']['x1'][old_index].astype('f4')
            output_vertices[i]['x2'] = mesh['vertex']['x2'][old_index].astype('f4')
            output_vertices[i]['y0'] = mesh['vertex']['y0'][old_index].astype('f4')
            output_vertices[i]['y1'] = mesh['vertex']['y1'][old_index].astype('f4')
            output_vertices[i]['y2'] = mesh['vertex']['y2'][old_index].astype('f4')
            output_vertices[i]['z0'] = mesh['vertex']['z0'][old_index].astype('f4')
            output_vertices[i]['z1'] = mesh['vertex']['z1'][old_index].astype('f4')
            output_vertices[i]['z2'] = mesh['vertex']['z3'][old_index].astype('f4')


    # New empty array for faces, to be added back to final PLY
    output_faces = np.empty([len(decimatedMesh.faces)], dtype=[('vertex_indices', 'i4', (3,))])

    # For each face, translate decimated mesh back to a sane format
    for i in range(0, len(decimatedMesh.faces)):
        face = np.empty(3, dtype=np.int32)
        face[0] = decimatedMesh.faces[i].v_1
        face[1] = decimatedMesh.faces[i].v_2
        face[2] = decimatedMesh.faces[i].v_2
        output_faces['vertex_indices'][i] = face


    # Exception handling
    if(os.path.exists(dirname + "/decimated") == False):
        print('The "decimated" folder not found. Creating a new one..', end = '')
        os.mkdir(dirname + "/decimated")
        print('Done')

    # Set the write path    
    poly_mesh_path = dirname + '/decimated/poly' + str(_current_keyframe) + '.ply'
    # Create ply and write it
    ply = PlyData([PlyElement.describe(output_vertices, 'vertex'), PlyElement.describe(output_faces, 'face')], text=True)
    ply.write(poly_mesh_path)

#======================================================================================================================

class Mesh:
    vertices = []
    has_normals = False
    num_uv_sets = 0
    normals = []
    faces = []
    num_faces = []
    uv_sets = []
    collapse_map = []

class Vertex:
    x = 0
    y = 0
    z = 0

class Face:
    v_1 = 0
    v_2 = 0
    v_3 = 0


#======================================================================================================================


if __name__ == '__main__':
    main()
