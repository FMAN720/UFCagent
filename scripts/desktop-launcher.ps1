param(
    [ValidateSet('start', 'stop')][string]$Action = 'start',
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectDir = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runtimeDir = Join-Path $projectDir '.launcher'
$stateFile = Join-Path $runtimeDir 'server.json'
$cliPath = Join-Path $projectDir 'node_modules\vinext\dist\cli.js'
$address = 'http://localhost:3000/'
$mutex = New-Object Threading.Mutex($false, 'Local\OCTAGON_UFCagent_Desktop')
$locked = $false

function Notify([string]$message, [bool]$failure = $false) {
    Write-Output $message
    if (-not $NoBrowser) {
        Add-Type -AssemblyName System.Windows.Forms
        $icon = if ($failure) { [Windows.Forms.MessageBoxIcon]::Error } else { [Windows.Forms.MessageBoxIcon]::Information }
        [void][Windows.Forms.MessageBox]::Show($message, 'UFC 智能助手', [Windows.Forms.MessageBoxButtons]::OK, $icon)
    }
}

function Read-State {
    if (Test-Path -LiteralPath $stateFile) {
        try { return Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json } catch { return $null }
    }
    return $null
}

function Get-OwnedServer($state) {
    if (-not $state -or -not $state.processId -or -not $state.startedAt) { return $null }
    $server = Get-Process -Id $state.processId -ErrorAction SilentlyContinue
    if (-not $server) { return $null }
    # PID reuse must never cause an unrelated process to be stopped.
    $started = [DateTime]::Parse($state.startedAt).ToUniversalTime()
    if ([Math]::Abs(($server.StartTime.ToUniversalTime() - $started).TotalSeconds) -gt 1) { return $null }
    $info = Get-CimInstance Win32_Process -Filter "ProcessId=$($server.Id)"
    if (-not $info.CommandLine -or $info.CommandLine.IndexOf($cliPath, [StringComparison]::OrdinalIgnoreCase) -lt 0) { return $null }
    return $server
}

function Test-App {
    try {
        $status = Invoke-RestMethod -Uri ($address + 'api/ufc?action=assistant-status') -TimeoutSec 3
        if ($status.mode -notin @('configured', 'data-only')) { return $false }
        $page = Invoke-WebRequest -Uri $address -UseBasicParsing -TimeoutSec 3
        return $page.StatusCode -eq 200 -and $page.Content.Contains('OCTAGON')
    } catch { return $false }
}

function Test-Port {
    $client = New-Object Net.Sockets.TcpClient
    try {
        $connecting = $client.ConnectAsync('localhost', 3000)
        [void]$connecting.Wait(500)
        return $client.Connected
    } catch { return $false } finally { $client.Dispose() }
}

function Stop-OwnedServer($server) {
    # Collect only descendants of the verified project process, using one shell.
    $all = @(Get-CimInstance Win32_Process)
    $owned = New-Object 'System.Collections.Generic.List[object]'
    function Add-Children([int]$parentId) {
        foreach ($child in $all | Where-Object { $_.ParentProcessId -eq $parentId }) {
            Add-Children ([int]$child.ProcessId)
            $owned.Add($child)
        }
    }
    Add-Children $server.Id
    # Stop the root first so it cannot respawn the collected children.
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    foreach ($child in $owned) {
        $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($child.ProcessId)" -ErrorAction SilentlyContinue
        if ($current -and $current.CreationDate -eq $child.CreationDate -and $current.ParentProcessId -eq $child.ParentProcessId) {
            Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    if (Test-Path -LiteralPath $stateFile) { Remove-Item -LiteralPath $stateFile }
}

try {
    try { $locked = $mutex.WaitOne(150000) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { throw '另一个启动或停止操作尚未完成，请稍后重试。' }
    Set-Location -LiteralPath $projectDir
    $server = Get-OwnedServer (Read-State)
    if ($Action -eq 'stop') {
        if ($server) {
            Stop-OwnedServer $server
            Notify 'UFC 智能助手已停止。浏览器页面可以关闭，下次双击启动图标即可。'
        } else {
            Notify '没有找到由此快捷方式启动的服务。如果你是在终端里启动的，请到该终端按 Ctrl+C 停止。'
        }
        exit 0
    }
    if (Test-App) {
        Write-Output "Already running: $address"
        if (-not $NoBrowser) { Start-Process $address }
        exit 0
    }
    if (-not $server) {
        if (Test-Port) { throw '3000 端口已被其他服务占用，或手动启动的项目仍在加载。请稍后重试；不要重复启动。' }
        if (-not (Test-Path -LiteralPath $cliPath)) { throw "项目依赖尚未安装。请在 $projectDir 中运行 npm ci 后重试。" }
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $nodeCommand) {
            $nodePath = Join-Path $env:ProgramFiles 'nodejs\node.exe'
            if (-not (Test-Path -LiteralPath $nodePath)) { throw '未找到 Node.js，请先安装 Node.js 22.13 或更新版本。' }
        } else { $nodePath = $nodeCommand.Source }
        [void](New-Item -ItemType Directory -Path $runtimeDir -Force)
        $server = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $cliPath + '"'), 'dev', '--host', '127.0.0.1', '--port', '3000') -WorkingDirectory $projectDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'stderr.log') -PassThru
        @{ processId = $server.Id; startedAt = $server.StartTime.ToUniversalTime().ToString('o'); project = $projectDir } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    do {
        if (Test-App) {
            Write-Output "Ready: $address"
            if (-not $NoBrowser) { Start-Process $address }
            exit 0
        }
        $server.Refresh()
        if ($server.HasExited) { throw "项目启动失败。请查看 $runtimeDir\stderr.log 中的错误信息。" }
        Start-Sleep -Milliseconds 700
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "启动超过两分钟。后台服务仍保留，可稍后再次双击启动；也可使用停止快捷方式关闭后重试。日志位于 $runtimeDir。"
} catch {
    Notify $_.Exception.Message $true
    exit 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
