$key = Join-Path $HOME '.ssh\hephastus_ed25519'
Write-Host "key: $key"
$hosts = @('beast-01.local','192.168.0.187','192.168.0.166','100.107.16.72','192.168.55.1')
foreach ($h in $hosts) {
    Write-Host '---'
    Write-Host "TRY $h"
    try {
        ssh -i $key -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no beast@$h hostname | Write-Host
        Write-Host 'SUCCESS'
    } catch {
        Write-Host "FAILED $h"
        Write-Host $_.Exception.Message
    }
}
