#!/bin/bash

DEFAULT_CONTAINER="ros_humble"

detect_platform() {
    PLATFORM="x86"
    CONTAINER_NAME="ros_humble"

    # 1️⃣ Jetson
    if [ -f "/etc/nv_tegra_release" ] || grep -qi "nvidia" /proc/device-tree/model 2>/dev/null; then
        PLATFORM="jetson"
        CONTAINER_NAME="ugv_jetson_ros_humble"
        return
    fi

    # 2️⃣ Raspberry Pi
    if grep -qi "raspberry pi" /proc/device-tree/model 2>/dev/null; then
        PLATFORM="rpi"
        CONTAINER_NAME="ugv_rpi_ros_humble"
        return
    fi

    # 3️⃣ ARM but unknown (fallback)
    ARCH=$(uname -m)
    if [[ "$ARCH" == "armv7l" || "$ARCH" == "aarch64" ]]; then
        PLATFORM="arm"
        CONTAINER_NAME="ugv_rpi_ros_humble"
        return
    fi

    # 4️⃣ default: x86 / VM
}

enter_container() {
    detect_platform

    echo "=============================="
    echo " Platform      : $PLATFORM"
    echo " Container     : $CONTAINER_NAME"
    echo "=============================="

    echo "▶ Starting container..."
    docker start "$CONTAINER_NAME" >/dev/null || {
        echo "❌ Failed to start container: $CONTAINER_NAME"
        return
    }
    echo "✅ Container started."

    echo "▶ Ensuring SSH service is running..."
    docker exec "$CONTAINER_NAME" bash -c \
        "service ssh status >/dev/null 2>&1 || service ssh start" >/dev/null
    echo "✅ SSH service ready."

    if [ "$PLATFORM" = "x86" ]; then
        echo "▶ Entering container shell (x86)..."
        docker exec -it "$CONTAINER_NAME" /bin/bash
    else
        echo "ℹ ARM platform detected ($PLATFORM)"
        echo "ℹ Skip interactive docker exec"
        echo "ℹ You can connect via SSH if needed"
        echo "ℹ Stop ugv-app.service"
        systemctl --user stop ugv-app.service
        exit
    fi
}

main_menu() {
    while true; do
        echo
        echo "Please choose an option:"
        echo "1. Enter container"
        echo "q. Quit"
        read -p "Enter your choice: " choice

        case "$choice" in
            1) enter_container ;;
            q|Q)
                echo "Bye."
                exit 0
                ;;
            *) echo "Invalid option." ;;
        esac
    done
}

main_menu
