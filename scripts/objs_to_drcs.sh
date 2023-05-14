INPUT=$1
OUTPUT=$2
COMPRESSION_LEVEL=${3:-7}
Q_POSITION_ATTR=${4:-11}
Q_TEXTURE_ATTR=${5:-10}
Q_NORMAL_ATTR=${6:-8}
Q_GENERIC_ATTR=${7:-8}


# setting working directory to script's location
# so that "../draco_encoder" points to the binary
cd "$(dirname "$0")"

for FILE in "$INPUT"/*.obj
do
    echo $FILE
    BASE_FILE=$(basename "$FILE" .obj)
    echo $BASE_FILE
    ../draco_encoder -i "$FILE" -o "$OUTPUT/$BASE_FILE.drc" \
    -qp $Q_POSITION_ATTR -qt $Q_TEXTURE_ATTR \
    -qn $Q_NORMAL_ATTR -qg $Q_GENERIC_ATTR \
    -cl $COMPRESSION_LEVEL
done