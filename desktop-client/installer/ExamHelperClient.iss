#define MyAppName "ExamHelper Screenshot Client"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "ExamHelper"
#define MyAppExeName "ExamHelperClient.exe"

[Setup]
AppId={{8BA6ABDA-9485-4DD1-9247-8B205ED6C301}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\ExamHelper\desktop-client
DefaultGroupName=ExamHelper
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=ExamHelperClientSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
AppMutex=Local\ExamHelperScreenshotClient

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Files]
Source: "..\dist\ExamHelperClient\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\ExamHelper Screenshot Client"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\ExamHelper Screenshot Client"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Registry]
Root: HKA; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "ExamHelperScreenshotClient"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch ExamHelper Screenshot Client"; Flags: postinstall nowait skipifsilent
