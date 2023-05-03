#!/bin/bash
for file in encode/*.obj;
do
    if [[ -x "./corto" ]]
        then
            ./corto $file;
        else
            ./src/corto $file;
        fi
done

for file in encode/*.ply;
do
    if [[ -x "./corto" ]]
        then
            ./corto $file;
        else
            ./src/corto $file;
        fi
done
