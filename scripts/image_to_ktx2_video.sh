# INPUT_PATTERN=$1 # "/media/appaji/DATA/XROS 3D files/OBJs/export/export_%05u.jpg"
# FILE_COUNT=$2 # 14
# FIRST_FILE=$3 # 0
# BATCH_SIZE=14

INPUT_PATTERN="/home/appaji/XROS/OBJ Captures/yoga_platform_tex-003/partial/small/yoga_plat.%05u.png"
FILE_COUNT=241
FIRST_FILE=1
BATCH_SIZE=14

current_start_file=$FIRST_FILE

min(){
    if [ $2 -lt $1 ]
    then
        echo $2
    else
        echo $1
    fi
}

for ((i=0;i<=FILE_COUNT;i+=BATCH_SIZE)); do
    current_start_file=$(($FIRST_FILE + $i))
    current_batch_size=$(min $BATCH_SIZE $(($FILE_COUNT - $i + 1)))
    padded_start=$(printf "%04d" $current_start_file)
    current_output_file="output_${padded_start}_${BATCH_SIZE}_frames.ktx2"
    /home/appaji/XROS/basis_universal/bin/basisu -ktx2 -comp_level 5 -tex_type video -multifile_printf "$INPUT_PATTERN" -multifile_num $current_batch_size -multifile_first $current_start_file -y_flip -output_file "$current_output_file"
done

