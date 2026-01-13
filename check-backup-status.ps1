# Office Booking System - Backup Status Checker
# Quick health check for backup system
# Author: Claude Code
# Usage: .\check-backup-status.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Office Booking Backup System Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$AllGood = $true

# Check 1: Scheduled Task
Write-Host "1. Checking scheduled task..." -ForegroundColor White
$Task = Get-ScheduledTask -TaskName "Office Booking Database Backup" -ErrorAction SilentlyContinue

if ($Task) {
    $TaskInfo = Get-ScheduledTaskInfo -TaskName "Office Booking Database Backup"
    Write-Host "   ✓ Task exists and is $($Task.State)" -ForegroundColor Green
    Write-Host "   Last run: $($TaskInfo.LastRunTime)" -ForegroundColor Gray
    Write-Host "   Next run: $($TaskInfo.NextRunTime)" -ForegroundColor Gray

    if ($TaskInfo.LastTaskResult -ne 0) {
        Write-Host "   ⚠️  Last task result: $($TaskInfo.LastTaskResult) (non-zero indicates error)" -ForegroundColor Yellow
        $AllGood = $false
    }
} else {
    Write-Host "   ✗ Scheduled task not found!" -ForegroundColor Red
    Write-Host "   Run: .\setup-backup-schedule.ps1" -ForegroundColor Yellow
    $AllGood = $false
}

Write-Host ""

# Check 2: Local Backups
Write-Host "2. Checking local backups..." -ForegroundColor White
$LocalPath = "C:\backups\office-booking\local"

if (Test-Path $LocalPath) {
    $LocalBackups = Get-ChildItem -Path $LocalPath -Filter "*.backup" |
        Sort-Object LastWriteTime -Descending

    if ($LocalBackups.Count -gt 0) {
        $Latest = $LocalBackups[0]
        $Age = (Get-Date) - $Latest.LastWriteTime
        $Size = [math]::Round($Latest.Length / 1MB, 2)

        Write-Host "   ✓ Found $($LocalBackups.Count) local backup(s)" -ForegroundColor Green
        Write-Host "   Latest: $($Latest.Name)" -ForegroundColor Gray
        Write-Host "   Size: $Size MB" -ForegroundColor Gray
        Write-Host "   Age: $([math]::Round($Age.TotalHours, 1)) hours" -ForegroundColor Gray

        if ($Age.TotalHours -gt 26) {
            Write-Host "   ⚠️  Latest backup is over 26 hours old!" -ForegroundColor Yellow
            $AllGood = $false
        }
    } else {
        Write-Host "   ⚠️  No backup files found in $LocalPath" -ForegroundColor Yellow
        $AllGood = $false
    }
} else {
    Write-Host "   ✗ Local backup directory not found: $LocalPath" -ForegroundColor Red
    $AllGood = $false
}

Write-Host ""

# Check 3: OneDrive Backups
Write-Host "3. Checking OneDrive backups..." -ForegroundColor White
$OneDrivePath = "$env:OneDrive\Backups\OfficeSchedule"

if ($env:OneDrive) {
    if (Test-Path $OneDrivePath) {
        $OneDriveBackups = Get-ChildItem -Path $OneDrivePath -Filter "*.backup" |
            Sort-Object LastWriteTime -Descending

        if ($OneDriveBackups.Count -gt 0) {
            $Latest = $OneDriveBackups[0]
            $Age = (Get-Date) - $Latest.LastWriteTime
            $Size = [math]::Round($Latest.Length / 1MB, 2)

            Write-Host "   ✓ Found $($OneDriveBackups.Count) OneDrive backup(s)" -ForegroundColor Green
            Write-Host "   Latest: $($Latest.Name)" -ForegroundColor Gray
            Write-Host "   Size: $Size MB" -ForegroundColor Gray
            Write-Host "   Age: $([math]::Round($Age.TotalHours, 1)) hours" -ForegroundColor Gray
        } else {
            Write-Host "   ⚠️  No backup files found in $OneDrivePath" -ForegroundColor Yellow
            $AllGood = $false
        }
    } else {
        Write-Host "   ⚠️  OneDrive backup directory not found: $OneDrivePath" -ForegroundColor Yellow
        Write-Host "   OneDrive may not have synced yet" -ForegroundColor Gray
        $AllGood = $false
    }
} else {
    Write-Host "   ✗ OneDrive not detected (ONEDRIVE environment variable not set)" -ForegroundColor Red
    Write-Host "   Install OneDrive for Business" -ForegroundColor Yellow
    $AllGood = $false
}

Write-Host ""

# Check 4: OneDrive Process
Write-Host "4. Checking OneDrive sync..." -ForegroundColor White
$OneDriveProcess = Get-Process -Name OneDrive -ErrorAction SilentlyContinue

if ($OneDriveProcess) {
    Write-Host "   ✓ OneDrive is running" -ForegroundColor Green
} else {
    Write-Host "   ✗ OneDrive process not running!" -ForegroundColor Red
    Write-Host "   Start OneDrive to sync backups to cloud" -ForegroundColor Yellow
    $AllGood = $false
}

Write-Host ""

# Check 5: Database Connection
Write-Host "5. Checking database..." -ForegroundColor White

# Load .env file
$EnvFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $Key = $matches[1].Trim()
            $Value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($Key, $Value, "Process")
        }
    }
}

if ($env:DB_PASSWORD) {
    $PostgreSQLBin = "C:\Program Files\PostgreSQL\16\bin"

    if (Test-Path "$PostgreSQLBin\psql.exe") {
        try {
            $env:PGPASSWORD = $env:DB_PASSWORD
            $Result = & "$PostgreSQLBin\psql.exe" `
                -U office_app `
                -d office_booking `
                -t `
                -c "SELECT COUNT(*) FROM bookings;" `
                2>&1

            Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

            $BookingCount = $Result.Trim()
            Write-Host "   ✓ Database connection successful" -ForegroundColor Green
            Write-Host "   Current bookings: $BookingCount" -ForegroundColor Gray

        } catch {
            Write-Host "   ✗ Database connection failed: $_" -ForegroundColor Red
            $AllGood = $false
        }
    } else {
        Write-Host "   ⚠️  PostgreSQL binaries not found at: $PostgreSQLBin" -ForegroundColor Yellow
        $AllGood = $false
    }
} else {
    Write-Host "   ⚠️  DB_PASSWORD not set in .env file" -ForegroundColor Yellow
    $AllGood = $false
}

Write-Host ""

# Check 6: Backup Logs
Write-Host "6. Checking backup logs..." -ForegroundColor White
$LogFile = "C:\backups\office-booking\local\backup.log"

if (Test-Path $LogFile) {
    $LogLines = Get-Content $LogFile -Tail 10
    $ErrorLines = $LogLines | Where-Object { $_ -match '\[ERROR\]' }

    if ($ErrorLines) {
        Write-Host "   ⚠️  Found $($ErrorLines.Count) error(s) in recent logs:" -ForegroundColor Yellow
        $ErrorLines | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Gray
        }
        $AllGood = $false
    } else {
        Write-Host "   ✓ No errors in recent logs" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠️  Log file not found (may not have run yet)" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan

if ($AllGood) {
    Write-Host "✓ Backup system is healthy!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Everything looks good. Backups are running as expected." -ForegroundColor White
} else {
    Write-Host "⚠️  Issues detected with backup system" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please review the warnings/errors above." -ForegroundColor White
    Write-Host "Refer to BACKUP-GUIDE.md for troubleshooting." -ForegroundColor Gray
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Quick actions
Write-Host "Quick actions:" -ForegroundColor White
Write-Host "  - Run backup now:    Start-ScheduledTask -TaskName 'Office Booking Database Backup'" -ForegroundColor Gray
Write-Host "  - View backups:      .\restore-database.ps1" -ForegroundColor Gray
Write-Host "  - Setup schedule:    .\setup-backup-schedule.ps1" -ForegroundColor Gray
Write-Host "  - Full guide:        Get-Content BACKUP-GUIDE.md" -ForegroundColor Gray
Write-Host ""
