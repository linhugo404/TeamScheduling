# Office Booking System - Setup Automated Backup Schedule
# Creates a Windows Task Scheduler task for daily database backups
# Author: Claude Code
# Usage: Run as Administrator

#Requires -RunAsAdministrator

param(
    [string]$BackupTime = "02:00",
    [string]$TaskName = "Office Booking Database Backup"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Automated Database Backup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$ScriptDir = $PSScriptRoot
$BackupScript = Join-Path $ScriptDir "backup-database.ps1"

# Validate backup script exists
if (-not (Test-Path $BackupScript)) {
    Write-Host "✗ Backup script not found: $BackupScript" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Backup script found: $BackupScript" -ForegroundColor Green
Write-Host ""

# Parse backup time
try {
    $Time = [DateTime]::ParseExact($BackupTime, "HH:mm", $null)
} catch {
    Write-Host "✗ Invalid time format. Use HH:mm (24-hour format)" -ForegroundColor Red
    exit 1
}

# Check if task already exists
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "⚠️  Task '$TaskName' already exists" -ForegroundColor Yellow
    $Overwrite = Read-Host "Do you want to overwrite it? (Y/N)"

    if ($Overwrite -ne "Y" -and $Overwrite -ne "y") {
        Write-Host "Setup cancelled" -ForegroundColor Yellow
        exit 0
    }

    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "✓ Existing task removed" -ForegroundColor Green
}

# Create scheduled task
Write-Host "Creating scheduled task..." -ForegroundColor Cyan
Write-Host "  Task Name: $TaskName" -ForegroundColor Gray
Write-Host "  Schedule: Daily at $BackupTime" -ForegroundColor Gray
Write-Host "  Script: $BackupScript" -ForegroundColor Gray
Write-Host ""

try {
    # Action: Run PowerShell script
    $Action = New-ScheduledTaskAction `
        -Execute "PowerShell.exe" `
        -Argument "-ExecutionPolicy Bypass -NoProfile -File `"$BackupScript`"" `
        -WorkingDirectory $ScriptDir

    # Trigger: Daily at specified time
    $Trigger = New-ScheduledTaskTrigger `
        -Daily `
        -At $Time

    # Settings
    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RunOnlyIfNetworkAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Hours 1)

    # Principal: Run as SYSTEM (highest privileges)
    $Principal = New-ScheduledTaskPrincipal `
        -UserId "SYSTEM" `
        -LogonType ServiceAccount `
        -RunLevel Highest

    # Register task
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -Description "Automated daily backup of Office Booking PostgreSQL database to local disk and OneDrive" `
        | Out-Null

    Write-Host "✓ Scheduled task created successfully!" -ForegroundColor Green
    Write-Host ""

    # Test the task
    Write-Host "Do you want to run a test backup now? (Y/N): " -NoNewline -ForegroundColor Yellow
    $Test = Read-Host

    if ($Test -eq "Y" -or $Test -eq "y") {
        Write-Host ""
        Write-Host "Running test backup..." -ForegroundColor Cyan
        Write-Host ""

        Start-ScheduledTask -TaskName $TaskName

        # Wait a moment for task to start
        Start-Sleep -Seconds 2

        # Show task status
        $TaskInfo = Get-ScheduledTaskInfo -TaskName $TaskName

        Write-Host "Task Status: $($TaskInfo.LastTaskResult)" -ForegroundColor Cyan
        Write-Host "Last Run: $($TaskInfo.LastRunTime)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Check the backup logs for details:" -ForegroundColor Gray
        Write-Host "  C:\backups\office-booking\local\backup.log" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Setup Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Backup schedule:" -ForegroundColor White
    Write-Host "  - Runs daily at $BackupTime" -ForegroundColor Gray
    Write-Host "  - Saves to C:\backups\office-booking\local (7 days)" -ForegroundColor Gray
    Write-Host "  - Copies to OneDrive\Backups\OfficeSchedule (30 days)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To manage the task:" -ForegroundColor White
    Write-Host "  - View: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    Write-Host "  - Run: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    Write-Host "  - Disable: Disable-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    Write-Host "  - Remove: Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To restore from backup:" -ForegroundColor White
    Write-Host "  .\restore-database.ps1" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Host "✗ Failed to create scheduled task: $_" -ForegroundColor Red
    exit 1
}
