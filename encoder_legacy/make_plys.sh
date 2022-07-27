# Absolute path this script is in, thus /home/user/bin
SCRIPT=$(readlink -f "$0")
# Absolute path this script is in, thus /home/user/bin
SCRIPTPATH=$(dirname "$SCRIPT")

count=`ls -1 $SCRIPTPATH/encode/*.obj 2>/dev/null | wc -l`

if [ $count == 0 ]; then 
    echo "No OBJs to convert!"
else
    for file in $SCRIPTPATH/encode/*.obj;
        do meshlabserver -i "$file" -o "${file%.}.ply" -m wt;
    done;
fi;