#!/usr/bin/env pwsh
<#
.SYNOPSIS
  StockFlow v2.0 — 1-Click Local Development Launcher (Frontend + Laravel API)
  Starts React/Vite on http://localhost:5173 and Laravel API on http://127.0.0.1:8000
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[StockFlow] Starting Backend API (http://127.0.0.1:8000) & Frontend Web (http://localhost:5173)..." -ForegroundColor Green

# Start Laravel API in a separate background PowerShell window
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; php artisan serve --host=127.0.0.1 --port=8000"

# Start React + Vite Frontend in foreground
Set-Location "$root\frontend"
npx vite --host 127.0.0.1 --port 5173
