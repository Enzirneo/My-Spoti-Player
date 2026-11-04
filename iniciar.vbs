' Abre o My Spoti Player sem janela de terminal.
' Dê dois cliques neste arquivo ou crie um atalho para ele (desktop, menu Iniciar).
Set shell = CreateObject("WScript.Shell")
projectDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = projectDir
shell.Run """" & projectDir & "\node_modules\electron\dist\electron.exe"" .", 0, False
