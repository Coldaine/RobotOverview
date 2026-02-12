#!/bin/bash

WS_ROOT="/home/ws/ugv_ws"
MAP_DIR="${WS_ROOT}/src/ugv_main/ugv_nav/maps"

if ! command -v ros2 >/dev/null 2>&1; then
    echo "❌ ros2 command not found. Did you source ROS 2?"
    exit 1
fi

mkdir -p "${MAP_DIR}" || exit 1

echo "======================================"
echo " Select mapping method to save map"
echo "======================================"
echo "  1) gmapping"
echo "  2) cartographer"
echo "  3) slam_toolbox"
echo "--------------------------------------"
read -rp "Enter choice [1-3]: " CHOICE

echo ""

case "$CHOICE" in

# ================= gmapping =================
1)
    echo "=== Saving map using gmapping ==="
    ros2 run nav2_map_server map_saver_cli \
        -f ${MAP_DIR}/map

    echo "✔ Gmapping map saved:"
    echo "  ${MAP_DIR}/map.pgm"
    echo "  ${MAP_DIR}/map.yaml"
    ;;

# ================= Cartographer =================
2)
    echo "=== Saving map using Cartographer ==="
    ros2 run nav2_map_server map_saver_cli \
        -f ${MAP_DIR}/map

    ros2 service call /write_state \
        cartographer_ros_msgs/srv/WriteState \
        "{filename: '${MAP_DIR}/map.pbstream'}"

    echo "✔ Cartographer state saved:"
    echo "  ${MAP_DIR}/map.pgm"
    echo "  ${MAP_DIR}/map.yaml"
    echo "  ${MAP_DIR}/map.pbstream"
    ;;

# ================= slam_toolbox =================
3)
    echo "=== Saving map using slam_toolbox ==="

    ros2 service call /slam_toolbox/save_map \
        slam_toolbox/srv/SaveMap \
        "name: {data: '${MAP_DIR}/map'}"

    ros2 service call /slam_toolbox/serialize_map \
        slam_toolbox/srv/SerializePoseGraph \
        "filename: '${MAP_DIR}/map'"
        
    echo "✔ slam_toolbox map saved:"
    echo "  ${MAP_DIR}/map.pgm"
    echo "  ${MAP_DIR}/map.yaml"
    echo "  ${MAP_DIR}/map.posegraph"
    ;;

*)
    echo "❌ Invalid choice: $CHOICE"
    echo "Please enter 1, 2 or 3."
    exit 1
    ;;
esac

echo ""
echo "✅ Done."
