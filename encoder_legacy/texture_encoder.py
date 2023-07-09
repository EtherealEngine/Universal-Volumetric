# Binary sequence texture encoder
# Takes a sequence of PNG images
# Adds a macro 

# importing cv2 
import cv2
  
# importing os module  
import os

import sys





#======================================================================================================================
#--------------------------------------------- MAIN Function ----------------------------------------------------------
#======================================================================================================================

def main(args):
    encode_path = "encode"

    if  len(args) < 2:
        print("Defaulting to the /encode folder for files since an argument was not provided")
    else:
        encode_path = args[1]

    dirname = os.path.dirname(os.path.realpath(__file__))

    print(dirname)
    encoderWindowSize = 8;
    frame_number = 0
    textures_in_group = []

    # TODO: Add path to where you can to encode, default to this
    Data_Path = dirname + "/" + encode_path
    print(Data_Path)

    # Exception Handling : If 'encode' folder is not there, create one
    assert os.path.exists(Data_Path), 'The Dataset Folder not found. Please consider giving full(absolute) file path.'

    for files in os.listdir(Data_Path):
        if files.endswith(".png") or files.endswith('.jpg'): # Exception Handling
                textures_in_group.append(Data_Path+"/"+files)
                print("Adding texture " +  str(frame_number+1) + " to group")
                frame_number = frame_number + 1
    textures_in_group.sort()
    for current_texture in range(len(textures_in_group)):
        img = cv2.imread(textures_in_group[current_texture])
        # Read image
        height, width, channels = img.shape
        # Read binary from frame number
        print(textures_in_group[current_texture] + " " + '{0:016b}'.format(current_texture))
        for index, value in enumerate('{0:016b}'.format(current_texture)):
            color = (0,0,0)
            if(value == '1'):
                color = (255,255,255)
            cv2.rectangle(img,(15-index*encoderWindowSize, height-1-encoderWindowSize),((15-index+1)*encoderWindowSize,height-1),color,-1)
        
        # save the image
        cv2.imwrite(textures_in_group[current_texture], img)

    print("Finished adding binary frame counter to textures");
    print("Make sure this isn't bleeding into your textures. You might need to scale your UVs to keep square texture.")
    print("We'll add UV autoscaling and appending later.")
#======================================================================================================================

if __name__ == '__main__':
    main(sys.argv)
