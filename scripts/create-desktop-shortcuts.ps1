$ErrorActionPreference = 'Stop'
$projectDir = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$launcher = Join-Path $PSScriptRoot 'desktop-launcher.ps1'
$desktop = [Environment]::GetFolderPath('Desktop')
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shell = New-Object -ComObject WScript.Shell
foreach ($entry in @(
    @{ Name = 'UFC 智能助手'; Action = 'start'; Icon = 'ufc-white.ico'; Description = '启动本地 UFC 智能助手并打开浏览器' },
    @{ Name = '停止 UFC 智能助手'; Action = 'stop'; Icon = 'ufc-red.ico'; Description = '停止由桌面快捷方式启动的 UFC 后台服务' }
)) {
    $path = Join-Path $desktop ($entry.Name + '.lnk')
    $shortcut = $shell.CreateShortcut($path)
    if ((Test-Path -LiteralPath $path) -and $shortcut.Arguments -notlike ('*' + $launcher + '*')) {
        throw "同名快捷方式已存在且不属于此项目，未覆盖：$path"
    }
    $shortcut.TargetPath = $powershell
    $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcher + '" -Action ' + $entry.Action
    $shortcut.WorkingDirectory = $projectDir
    $shortcut.Description = $entry.Description
    $iconPath = Join-Path $projectDir ('assets\desktop\' + $entry.Icon)
    if (-not (Test-Path -LiteralPath $iconPath)) { throw "未找到图标：$iconPath" }
    $shortcut.IconLocation = $iconPath + ',0'
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    Write-Output $path
}
