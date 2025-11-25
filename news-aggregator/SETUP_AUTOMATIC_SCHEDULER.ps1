# Glas Politics - Automatic News Scheduler Setup
# This script creates a Windows Task Scheduler task to run the news aggregator automatically

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Glas Politics - Automatic News Scheduler" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click this file and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Task details
$taskName = "Glas Politics - Daily News Aggregator"
$taskDescription = "Automatically fetches and analyzes Irish political news once daily at 8 AM"
$scriptPath = Join-Path $PSScriptRoot "scheduler_daily.py"
$workingDirectory = $PSScriptRoot

# Check if Python is available
try {
    $pythonPath = (Get-Command py -ErrorAction Stop).Source
    Write-Host "[OK] Python found at: $pythonPath" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python not found! Please install Python first." -ForegroundColor Red
    pause
    exit 1
}

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host ""
    Write-Host "Task '$taskName' already exists!" -ForegroundColor Yellow
    $response = Read-Host "Do you want to replace it? (Y/N)"
    
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "Setup cancelled." -ForegroundColor Yellow
        pause
        exit 0
    }
    
    Write-Host "Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Write-Host ""
Write-Host "Creating scheduled task..." -ForegroundColor Cyan

# Create the action (what to run)
$action = New-ScheduledTaskAction `
    -Execute "py" `
    -Argument "scheduler_daily.py" `
    -WorkingDirectory $workingDirectory

# Create the trigger (when to run)
$trigger = New-ScheduledTaskTrigger -AtStartup

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)

# Create the principal (run as current user)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Highest

# Register the task
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Description $taskDescription `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Force | Out-Null
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS! Task created successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  Name: $taskName"
    Write-Host "  Runs: At system startup"
    Write-Host "  Updates: Once daily at 8:00 AM"
    Write-Host "  Script: $scriptPath"
    Write-Host ""
    Write-Host "What happens next:" -ForegroundColor Yellow
    Write-Host "  - The scheduler will start automatically when Windows boots"
    Write-Host "  - It will fetch news once per day at 8:00 AM"
    Write-Host "  - Only NEW articles are processed (saves money!)"
    Write-Host "  - You can manually start it now from Task Scheduler"
    Write-Host ""
    Write-Host "To manage the task:" -ForegroundColor Cyan
    Write-Host "  1. Open Task Scheduler (search 'Task Scheduler' in Start menu)"
    Write-Host "  2. Look for '$taskName'"
    Write-Host "  3. Right-click to Start/Stop/Disable"
    Write-Host ""
    
    $response = Read-Host "Do you want to start the scheduler now? (Y/N)"
    
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host ""
        Write-Host "Starting scheduler..." -ForegroundColor Cyan
        Start-ScheduledTask -TaskName $taskName
        Write-Host "Scheduler started! Check Task Scheduler for status." -ForegroundColor Green
    }
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to create scheduled task!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
pause

