$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$outDir = "C:\Users\srima\.gemini\antigravity\brain\83f9c3a4-3004-40a4-bd8d-b7557e540ec5\screenshots"
$publicDir = "C:\Users\srima\.gemini\antigravity\scratch\marrowQ-quanthack-project\frontend\public\screenshots"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

$views = @(
    @{ name = "01_patient_overview.png"; url = "http://127.0.0.1:5173/#overview"; wait = 5000 },
    @{ name = "02_recovery_tracker.png"; url = "http://127.0.0.1:5173/#progress"; wait = 5000 },
    @{ name = "03_prediction_engine.png"; url = "http://127.0.0.1:5173/#prediction"; wait = 5000 },
    @{ name = "04_diagnostic_consensus.png"; url = "http://127.0.0.1:5173/#diagnostic"; wait = 5000 },
    @{ name = "05_quantum_lab.png"; url = "http://127.0.0.1:5173/#quantum"; wait = 6000 },
    @{ name = "06_dataset_cohort.png"; url = "http://127.0.0.1:5173/#dataset"; wait = 5000 },
    @{ name = "07_hospital_analytics.png"; url = "http://127.0.0.1:5173/#hospital"; wait = 5000 }
)

foreach ($v in $views) {
    $outFile = Join-Path $outDir $v.name
    $publicFile = Join-Path $publicDir $v.name
    Write-Host "Capturing $($v.name) from $($v.url)..."
    Start-Process -FilePath $edgePath -ArgumentList "--headless=new --screenshot=`"$outFile`" --window-size=1440,950 --virtual-time-budget=$($v.wait) $($v.url)" -Wait
    if (Test-Path $outFile) {
        Copy-Item -Path $outFile -Destination $publicFile -Force
        $len = (Get-Item $outFile).Length
        Write-Host "  -> Captured: $len bytes"
    } else {
        Write-Warning "  -> Failed to capture $($v.name)"
    }
}

Write-Host "All screenshots captured successfully!"
