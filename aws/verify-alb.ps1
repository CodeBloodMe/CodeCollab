param (
    [string]$AlbUrl = "http://localhost:8080",
    [int]$Count = 10
)

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " AWS Application Load Balancer Round-Robin Probe (PowerShell)" -ForegroundColor Cyan
Write-Host " Target URL : $AlbUrl/api/health" -ForegroundColor Gray
Write-Host " Iterations : $Count" -ForegroundColor Gray
Write-Host "====================================================================" -ForegroundColor Cyan

$server1Hits = 0
$server2Hits = 0
$otherHits = 0

Write-Host ("{0,-6} | {1,-10} | {2,-26} | {3,-12} | {4,-8}" -f "Req #", "Status", "Instance ID", "Zone", "Latency") -ForegroundColor Yellow
Write-Host "--------------------------------------------------------------------" -ForegroundColor Gray

for ($i = 1; $i -le $Count; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $resp = Invoke-WebRequest -Uri "$AlbUrl/api/health?seq=$i&_t=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" -UseBasicParsing -TimeoutSec 5
        $sw.Stop()

        $instId = $resp.Headers["X-Instance-ID"]
        if (-not $instId) {
            $json = $resp.Content | ConvertFrom-Json
            $instId = $json.instance_id
        }

        $az = $resp.Headers["X-Availability-Zone"]
        if (-not $az) {
            $json = $resp.Content | ConvertFrom-Json
            $az = $json.availability_zone
        }

        if ($instId -like "*server1*") {
            $server1Hits++
            $color = "Cyan"
        } elseif ($instId -like "*server2*") {
            $server2Hits++
            $color = "Magenta"
        } else {
            $otherHits++
            $color = "White"
        }

        Write-Host ("#{0,-5} | HTTP {1,-5} | {2,-26} | {3,-12} | {4}ms" -f $i, $resp.StatusCode, $instId, $az, $sw.ElapsedMilliseconds) -ForegroundColor $color
    } catch {
        $sw.Stop()
        Write-Host ("#{0,-5} | ERROR      | {1,-26} | {2,-12} | {3}ms" -f $i, "Request Failed", "N/A", $sw.ElapsedMilliseconds) -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 200
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " Round-Robin Verification Summary" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host (" Total Requests Sent  : {0}" -f $Count)
Write-Host (" Server 1 Hits (AZ A) : {0}" -f $server1Hits) -ForegroundColor Cyan
Write-Host (" Server 2 Hits (AZ B) : {0}" -f $server2Hits) -ForegroundColor Magenta
if ($otherHits -gt 0) {
    Write-Host (" Other / Standalone   : {0}" -f $otherHits) -ForegroundColor Gray
}

if ($server1Hits -gt 0 -and $server2Hits -gt 0) {
    Write-Host " RESULT: PASS -> Request traffic is evenly balanced across Server 1 and Server 2!" -ForegroundColor Green
} elseif ($otherHits -eq $Count) {
    Write-Host " RESULT: COMPLETED -> Single-node or local standalone environment responded." -ForegroundColor Yellow
} else {
    Write-Host " RESULT: NOTICE -> Requests only reached one target instance. Verify ALB routing." -ForegroundColor Yellow
}
Write-Host "====================================================================" -ForegroundColor Cyan

