' Matrix GUI Launcher — double-click to start
' Opens PowerShell with matrix.ps1, no manual typing needed
Dim shell
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run "powershell.exe -ExecutionPolicy Bypass -NoExit -File """ & shell.CurrentDirectory & "\matrix.ps1""", 1, False
