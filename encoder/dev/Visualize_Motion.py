import numpy as np
import matplotlib.pyplot as plt
from plyfile import PlyData
from mpl_toolkits.mplot3d import Axes3D
import os
from tqdm import tqdm
import warnings
warnings.simplefilter('ignore', np.RankWarning)
dirname = os.path.dirname(__file__)


def plot_motion(Meshes_Array):

    ''' This is a function to visualize the movement of vertices of a 3D object through n number of frames. All
    the frames are in the dataset_path folder saved as ply files. This functions takes each ply file as a frame and
    visualzes where each vertex has moved through these frames. '''

    if( len(Meshes_Array) < 2 ) : return
    frame_list = []
    Coordinates = ('x', 'y', 'z')
    Major_Array = []
    fitted_Array = []
    xp = np.linspace(-2, 2, 100)
    ax = plt.axes(projection='3d')

    Vertices_to_show = 10000 # Enter Manually How many vertices you want to plot. Not all vertices are shown(by default) to save time and complexity.

    for i in range(min(Vertices_to_show, len(Meshes_Array[0]['vertex']['x']))):# 14
        Major_Array.append([[], [], []]) # X, Y, Z for each mesh/frame
        fitted_Array.append([])

    for i in range(len(Meshes_Array)):# 4
        frame_list.append(i)
        for p in range(len(Coordinates)):
            for j in range(len(Major_Array)): # 14
                Major_Array[j][p].append(Meshes_Array[i]['vertex'][j][p])

    print("Plotting")
    for j in tqdm(range(len(Major_Array))):
        for p in range(len(Coordinates)):
            model = np.polyfit(frame_list, Major_Array[j][p], 4)
            fitted_Array[j].append(np.poly1d(model))
        ax.plot3D(fitted_Array[j][0](xp), fitted_Array[j][1](xp), fitted_Array[j][2](xp), label = 'Vertex' + str(i+1))

    
    # plt.legend()
    plt.show()

    # Uncomment the following line if you want to save the plot in the current working directory
    # plt.savefig(dirname + '/plot2.png') 





vertex_count_in_last_ply = 0
frame_number = 0
meshes_in_group = []

# Provide path of dataset here
dataset_path = dirname + '/output_ply_face_uvs'

# Exception Handling
assert os.path.exists(dataset_path), 'Dataset Path not found. Please recheck the path or Enter absolute folder path.'

print("Processing Frames...")
for files in tqdm(os.listdir(dataset_path)):
    if files.endswith(".ply"): # Exception Handling
        
        mesh = PlyData.read(dataset_path + '/' + files)

        if (frame_number > 0 and len(mesh['vertex']['x']) != vertex_count_in_last_ply):
            plot_motion(meshes_in_group)
            print('New Shape at Frame', frame_number)
            meshes_in_group = [mesh]
        else:
            meshes_in_group.append(mesh)

        vertex_count_in_last_ply = len(mesh['vertex']['x'])
        frame_number += 1

plot_motion(meshes_in_group)