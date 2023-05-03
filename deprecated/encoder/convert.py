import sys
import os
from pathlib import Path
#import pymeshlab as ml
  
def main():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] # get all args after "--"

    inputPath = argv[0] 
    outputPath = argv[1] 

    urls = []

    for fileName in os.listdir(inputPath):
        fileName = fileName.lower()
        if fileName.endswith("obj"): 
            url = os.path.abspath(os.path.join(inputPath, fileName))
            urls.append(url)
    urls.sort()

    for i in range(0, len(urls)):  
        print("\nLoading meshes " + str(i+1) + " / " + str(len(urls)))
       
        '''
        ms = ml.MeshSet()
        ms.load_new_mesh(urls[i])
        mesh = ms.current_mesh()
        '''

        newUrl = os.path.abspath(os.path.join(outputPath,"output" + str(i) + ".crt"))
        
        #ms.save_current_mesh(newUrl)

        os.system("./corto " + urls[i] + " -o " + newUrl)

main()
