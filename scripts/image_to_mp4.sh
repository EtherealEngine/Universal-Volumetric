INPUT=$1
OUTPUT=$2
FRAME_RATE=$3
WIDTH=$4
HEIGHT=$5
AUDIO_PATH=$6


INTERMEDIATE_VIDEO_FILE="/tmp/out.mp4"
TMP_FILE="/tmp/IMAGE_FILES.txt"
touch $TMP_FILE
# echo "$INPUT"
# find "$INPUT" -type f \( -iname '*.jpg' -o -iname '*.png' \)
find "$INPUT" -type f \( -iname '*.jpg' -o -iname '*.png' \) -exec echo file \'{}\' >> $TMP_FILE \;
ffmpeg -safe 0 -f concat -i $TMP_FILE -framerate $FRAME_RATE -vf scale=$WIDTH:$HEIGHT -c:v libx264 -pix_fmt yuv420p "$INTERMEDIATE_VIDEO_FILE"


ffmpeg -i "$INTERMEDIATE_VIDEO_FILE" -i "$AUDIO_PATH" -map 0:v -map 1:a -c:v copy -shortest "$OUTPUT"

rm $TMP_FILE $INTERMEDIATE_VIDEO_FILE