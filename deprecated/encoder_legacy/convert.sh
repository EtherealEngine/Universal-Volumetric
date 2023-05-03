#!/bin/sh
#!/usr/bin/env node

DIR=`pwd`
ASSETS_PATH=$DIR"/assets"
TEMP_PATH=$DIR"/assets/temps"

read -r -p "Enter output name: " input

mkdir -p $TEMP_PATH

for path in "$ASSETS_PATH"/*.obj; do
    file="$TEMP_PATH/$(basename "$path")"
    meshlabserver -i "$path" -o "${file%.*}.ply" -m wt
done
for path in "$TEMP_PATH"/*.ply; do
    ./corto $path
done

node "$DIR/Encoder.js" $input

rm -rf $TEMP_PATH


