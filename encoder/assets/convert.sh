for file in *.obj; do
    meshlabserver -i "$file" -o "${file%.*}.ply" -m wt
done
