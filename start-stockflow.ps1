#!/usr/bin/env pwsh
<#
.SYNOPSIS
  StockFlow v2.0 — 1-Click Local Development Launcher (Dedicated Non-Colliding Ports)
  Starts React/Vite on http://127.0.0.1:5175 and Laravel API on http://127.0.0.1:8005
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[StockFlow] Starting Backend API (http://127.0.0.1:8005) & Frontend Web (http://127.0.0.1:5175)..." -ForegroundColor Green

# Start Laravel API in a separate background PowerShell window
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; php artisan serve --host=127.0.0.1 --port=8005"

# Start React + Vite Frontend in foreground on dedicated port 5175 (avoids 5173 collisions)
Set-Location "$root\frontend"
npx vite --host 127.0.0.1 --port 5175
