#define MyAppName "Microphone"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Microphone"
#define MyAppExeName "Microphone.exe"

[Setup]
AppId={{8BA6ABDA-9485-4DD1-9247-8B205ED6C301}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Microphone
DefaultGroupName=Microphone
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=MicrophoneSetup
SetupIconFile=..\microphone.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
AppMutex=Local\Microphone

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Files]
Source: "..\dist\Microphone.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Microphone"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\Microphone"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\Microphone"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch Microphone"; Flags: postinstall nowait skipifsilent
