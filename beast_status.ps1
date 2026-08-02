$key = Join-Path $HOME '.ssh\hephastus_ed25519'
Write-Host "Using key: $key"
Write-Host '--- Service status ---'
try {
    ssh -i $key -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no beast@192.168.0.187 'bash -lc "systemctl is-active beast-ros-base.service"' | Write-Host
} catch {
    Write-Host 'SERVICE CHECK FAILED:' $_.Exception.Message
}
Write-Host '--- allow_motion param ---'
try {
    ssh -i $key -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no beast@192.168.0.187 'bash -lc "source /opt/ros/humble/setup.bash && source ~/beast/ugv_ws/install/setup.bash && ros2 param get /bringup allow_motion"' | Write-Host
} catch {
    Write-Host 'PARAM CHECK FAILED:' $_.Exception.Message
}
