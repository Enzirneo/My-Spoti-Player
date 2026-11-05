' Abre o My Spoti Player sem janela de terminal.
' Dê dois cliques neste arquivo ou crie um atalho para ele (desktop, menu Iniciar).
Set shell = CreateObject("WScript.Shell")
projectDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = projectDir
' Estilo 1 (janela normal): com 0 (oculto) o Windows repassa "oculto" à primeira janela do app e o fundo acrílico
' fica só uma caixa cinza vazia. O electron.exe não abre terminal, então não há console para esconder.
shell.Run """" & projectDir & "\node_modules\electron\dist\electron.exe"" .", 1, False
