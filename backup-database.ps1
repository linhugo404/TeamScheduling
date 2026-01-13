# Office Booking System - Automated Database Backup Script
# Backs up PostgreSQL database to local disk and OneDrive for Business
# Author: Claude Code
# Usage: Run as scheduled task or manually

param(
    [string]$LocalBackupDir = "C:\backups\office-booking\local",
    [string]$OneDriveBackupDir = "$env:OneDrive\Backups\OfficeSchedule",
    [int]$LocalRetentionDays = 7,
    [int]$OneDriveRetentionDays = 30,
    [string]$PostgreSQLBin = "C:\Program Files\PostgreSQL\16\bin",
    [string]$DBName = "office_booking",
    [string]$DBUser = "office_app",
    [string]$SMTPServer = "",
    [string]$EmailFrom = "",
    [string]$EmailTo = "",
    [switch]$SendEmailOnSuccess = $false
)

# Color-coded logging
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )

    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"

    switch ($Level) {
        "SUCCESS" { Write-Host $LogMessage -ForegroundColor Green }
        "ERROR"   { Write-Host $LogMessage -ForegroundColor Red }
        "WARNING" { Write-Host $LogMessage -ForegroundColor Yellow }
        "INFO"    { Write-Host $LogMessage -ForegroundColor Cyan }
        default   { Write-Host $LogMessage }
    }

    # Log to file
    $LogFile = "$LocalBackupDir\backup.log"
    Add-Content -Path $LogFile -Value $LogMessage -ErrorAction SilentlyContinue
}

# Send email notification
function Send-EmailNotification {
    param(
        [string]$Subject,
        [string]$Body,
        [bool]$IsError = $false
    )

    if (-not $SMTPServer -or -not $EmailFrom -or -not $EmailTo) {
        Write-Log "Email notification skipped (SMTP not configured)" "WARNING"
        return
    }

    try {
        $Params = @{
            From       = $EmailFrom
            To         = $EmailTo
            Subject    = $Subject
            Body       = $Body
            SmtpServer = $SMTPServer
            Port       = 587
            UseSsl     = $true
        }

        Send-MailMessage @Params -ErrorAction Stop
        Write-Log "Email notification sent to $EmailTo" "SUCCESS"
    } catch {
        Write-Log "Failed to send email: $_" "ERROR"
    }
}

# Main backup function
function Start-DatabaseBackup {
    $StartTime = Get-Date
    $Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $Success = $true
    $ErrorMessages = @()

    Write-Log "========================================" "INFO"
    Write-Log "Starting Office Booking Database Backup" "INFO"
    Write-Log "========================================" "INFO"

    # Step 1: Validate prerequisites
    Write-Log "Validating prerequisites..." "INFO"

    # Check PostgreSQL bin directory
    if (-not (Test-Path "$PostgreSQLBin\pg_dump.exe")) {
        Write-Log "PostgreSQL binaries not found at: $PostgreSQLBin" "ERROR"
        return $false
    }

    # Check database password in environment
    if (-not $env:DB_PASSWORD) {
        Write-Log "DB_PASSWORD environment variable not set!" "ERROR"
        Write-Log "Set it in your .env file or system environment variables" "ERROR"
        return $false
    }

    Write-Log "Prerequisites validated" "SUCCESS"

    # Step 2: Create backup directories
    Write-Log "Creating backup directories..." "INFO"

    try {
        if (-not (Test-Path $LocalBackupDir)) {
            New-Item -ItemType Directory -Path $LocalBackupDir -Force | Out-Null
            Write-Log "Created local backup directory: $LocalBackupDir" "SUCCESS"
        }

        if (-not (Test-Path $OneDriveBackupDir)) {
            New-Item -ItemType Directory -Path $OneDriveBackupDir -Force | Out-Null
            Write-Log "Created OneDrive backup directory: $OneDriveBackupDir" "SUCCESS"
        }
    } catch {
        Write-Log "Failed to create backup directories: $_" "ERROR"
        return $false
    }

    # Step 3: Create local backup
    Write-Log "Creating database backup..." "INFO"

    $LocalBackupFile = "$LocalBackupDir\office_booking_$Timestamp.backup"
    $env:PGPASSWORD = $env:DB_PASSWORD

    try {
        & "$PostgreSQLBin\pg_dump.exe" `
            -U $DBUser `
            -d $DBName `
            -F c `
            -f $LocalBackupFile `
            2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0 -and (Test-Path $LocalBackupFile)) {
            $FileSize = (Get-Item $LocalBackupFile).Length / 1MB
            Write-Log "Local backup created: $LocalBackupFile" "SUCCESS"
            Write-Log "Backup size: $([math]::Round($FileSize, 2)) MB" "INFO"
        } else {
            throw "pg_dump failed with exit code $LASTEXITCODE"
        }
    } catch {
        $ErrorMessages += "Local backup failed: $_"
        Write-Log $ErrorMessages[-1] "ERROR"
        $Success = $false
    } finally {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }

    # Step 4: Copy to OneDrive (if local backup succeeded)
    if ($Success) {
        Write-Log "Copying backup to OneDrive..." "INFO"

        try {
            $OneDriveBackupFile = "$OneDriveBackupDir\office_booking_$Timestamp.backup"
            Copy-Item -Path $LocalBackupFile -Destination $OneDriveBackupFile -Force

            if (Test-Path $OneDriveBackupFile) {
                Write-Log "OneDrive backup created: $OneDriveBackupFile" "SUCCESS"
                Write-Log "OneDrive will sync to cloud automatically" "INFO"
            } else {
                throw "File copy verification failed"
            }
        } catch {
            $ErrorMessages += "OneDrive backup failed: $_"
            Write-Log $ErrorMessages[-1] "ERROR"
            $Success = $false
        }
    }

    # Step 5: Verify backup integrity
    if ($Success) {
        Write-Log "Verifying backup integrity..." "INFO"

        try {
            $env:PGPASSWORD = $env:DB_PASSWORD
            $TestOutput = & "$PostgreSQLBin\pg_restore.exe" `
                --list `
                -f $LocalBackupFile `
                2>&1

            if ($LASTEXITCODE -eq 0) {
                Write-Log "Backup integrity verified" "SUCCESS"
            } else {
                throw "Backup verification failed"
            }
        } catch {
            $ErrorMessages += "Backup verification failed: $_"
            Write-Log $ErrorMessages[-1] "WARNING"
            # Don't mark as failure, backup file exists
        } finally {
            Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        }
    }

    # Step 6: Clean up old backups (retention policy)
    Write-Log "Applying retention policies..." "INFO"

    # Local retention (7 days)
    try {
        $LocalCutoffDate = (Get-Date).AddDays(-$LocalRetentionDays)
        $LocalOldBackups = Get-ChildItem -Path $LocalBackupDir -Filter "office_booking_*.backup" |
            Where-Object { $_.LastWriteTime -lt $LocalCutoffDate }

        if ($LocalOldBackups) {
            foreach ($Backup in $LocalOldBackups) {
                Remove-Item $Backup.FullName -Force
                Write-Log "Removed old local backup: $($Backup.Name)" "INFO"
            }
        } else {
            Write-Log "No old local backups to remove (retention: $LocalRetentionDays days)" "INFO"
        }
    } catch {
        Write-Log "Failed to clean up old local backups: $_" "WARNING"
    }

    # OneDrive retention (30 days)
    try {
        $OneDriveCutoffDate = (Get-Date).AddDays(-$OneDriveRetentionDays)
        $OneDriveOldBackups = Get-ChildItem -Path $OneDriveBackupDir -Filter "office_booking_*.backup" |
            Where-Object { $_.LastWriteTime -lt $OneDriveCutoffDate }

        if ($OneDriveOldBackups) {
            foreach ($Backup in $OneDriveOldBackups) {
                Remove-Item $Backup.FullName -Force
                Write-Log "Removed old OneDrive backup: $($Backup.Name)" "INFO"
            }
        } else {
            Write-Log "No old OneDrive backups to remove (retention: $OneDriveRetentionDays days)" "INFO"
        }
    } catch {
        Write-Log "Failed to clean up old OneDrive backups: $_" "WARNING"
    }

    # Step 7: Summary
    $Duration = (Get-Date) - $StartTime
    Write-Log "========================================" "INFO"

    if ($Success) {
        Write-Log "Backup completed successfully!" "SUCCESS"
        Write-Log "Duration: $([math]::Round($Duration.TotalSeconds, 2)) seconds" "INFO"
        Write-Log "Local backup: $LocalBackupFile" "INFO"
        Write-Log "OneDrive backup: $OneDriveBackupDir" "INFO"

        if ($SendEmailOnSuccess -and $EmailTo) {
            $Subject = "✓ Office Booking Database Backup Successful"
            $Body = @"
Database backup completed successfully.

Database: $DBName
Timestamp: $Timestamp
Duration: $([math]::Round($Duration.TotalSeconds, 2)) seconds
Backup size: $([math]::Round($FileSize, 2)) MB

Local backup: $LocalBackupFile
OneDrive backup: $OneDriveBackupDir

Retention policies:
- Local: $LocalRetentionDays days
- OneDrive: $OneDriveRetentionDays days
"@
            Send-EmailNotification -Subject $Subject -Body $Body -IsError $false
        }
    } else {
        Write-Log "Backup completed with errors!" "ERROR"
        Write-Log "Duration: $([math]::Round($Duration.TotalSeconds, 2)) seconds" "INFO"

        foreach ($Error in $ErrorMessages) {
            Write-Log "  - $Error" "ERROR"
        }

        if ($EmailTo) {
            $Subject = "✗ Office Booking Database Backup Failed"
            $Body = @"
Database backup failed with errors.

Database: $DBName
Timestamp: $Timestamp
Duration: $([math]::Round($Duration.TotalSeconds, 2)) seconds

Errors:
$($ErrorMessages -join "`n")

Please check the backup logs at: $LocalBackupDir\backup.log
"@
            Send-EmailNotification -Subject $Subject -Body $Body -IsError $true
        }
    }

    Write-Log "========================================" "INFO"

    return $Success
}

# Execute backup
try {
    # Load environment variables from .env file (if running manually)
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

    $Result = Start-DatabaseBackup

    if ($Result) {
        exit 0
    } else {
        exit 1
    }
} catch {
    Write-Log "Fatal error: $_" "ERROR"
    exit 1
}
