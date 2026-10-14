param([ValidateSet('windows','window','volume_get','volume_set','brightness_get','brightness_set','screenshot','restart','shutdown')][string]$Action,[string]$Operation,[long]$WindowId,[ValidateRange(0,100)][int]$Value,[string]$OutputPath)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class ApexNative {
 delegate bool WindowCallback(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback cb,IntPtr p);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h,StringBuilder b,int n);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);
 public static Dictionary<long,string> Windows(){var found=new Dictionary<long,string>();EnumWindows((h,p)=>{var b=new StringBuilder(512);if(IsWindowVisible(h)&&GetWindowText(h,b,512)>0)found[h.ToInt64()]=b.ToString();return true;},IntPtr.Zero);return found;}
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class Enumerator {}
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IEnum {[PreserveSig] int Enum(int f,int m,out IntPtr p);[PreserveSig] int Default(int f,int r,out IDevice d);}
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IDevice {[PreserveSig] int Activate(ref Guid id,int c,IntPtr p,[MarshalAs(UnmanagedType.IUnknown)]out object o);}
 [ComImport,Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IVolume {
 [PreserveSig] int Register(IntPtr p);[PreserveSig] int Unregister(IntPtr p);[PreserveSig] int Count(out uint n);[PreserveSig] int SetDb(float v,ref Guid g);[PreserveSig] int Set(float v,ref Guid g);[PreserveSig] int GetDb(out float v);[PreserveSig] int Get(out float v);[PreserveSig] int SetChannelDb(uint c,float v,ref Guid g);[PreserveSig] int SetChannel(uint c,float v,ref Guid g);[PreserveSig] int GetChannelDb(uint c,out float v);[PreserveSig] int GetChannel(uint c,out float v);[PreserveSig] int Mute([MarshalAs(UnmanagedType.Bool)]bool m,ref Guid g);[PreserveSig] int IsMuted([MarshalAs(UnmanagedType.Bool)]out bool m);
 }
 static IVolume Endpoint(){IDevice d;Marshal.ThrowExceptionForHR(((IEnum)new Enumerator()).Default(0,1,out d));object o;Guid id=typeof(IVolume).GUID;Marshal.ThrowExceptionForHR(d.Activate(ref id,23,IntPtr.Zero,out o));return (IVolume)o;}
 public static int Volume(){float v;Marshal.ThrowExceptionForHR(Endpoint().Get(out v));return (int)Math.Round(v*100);}
 public static int SetVolume(int v){Guid g=Guid.Empty;Marshal.ThrowExceptionForHR(Endpoint().Set(v/100f,ref g));return Volume();}
}
'@
switch($Action){
 'windows' { ConvertTo-Json -InputObject @([ApexNative]::Windows().GetEnumerator() | ForEach-Object {@{id=$_.Key;title=$_.Value}}) -Compress }
 'window' {if(-not [ApexNative]::Windows().ContainsKey($WindowId)){throw 'Window no longer exists.'};$h=[IntPtr]::new($WindowId);switch($Operation){'focus' {$ok=[ApexNative]::SetForegroundWindow($h)} 'minimize' {$null=[ApexNative]::ShowWindow($h,6);$ok=$true} 'maximize' {$null=[ApexNative]::ShowWindow($h,3);$ok=$true} 'snap_left' {$ok=[ApexNative]::SetWindowPos($h,[IntPtr]::Zero,0,0,([ApexNative]::GetSystemMetrics(0)/2),[ApexNative]::GetSystemMetrics(1),4)} 'snap_right' {$width=[ApexNative]::GetSystemMetrics(0);$ok=[ApexNative]::SetWindowPos($h,[IntPtr]::Zero,($width/2),0,($width/2),[ApexNative]::GetSystemMetrics(1),4)} default {throw 'Unsupported window operation.'}};@{id=$WindowId;operation=$Operation;accepted=$ok;verifiedGeometry=$false}|ConvertTo-Json -Compress}
 'volume_get' {@{percent=[ApexNative]::Volume()}|ConvertTo-Json -Compress}
 'volume_set' {$before=[ApexNative]::Volume();$after=[ApexNative]::SetVolume($Value);if([Math]::Abs($after-$Value)-gt 1){throw 'Volume readback did not match.'};@{before=$before;after=$after;verified=$true}|ConvertTo-Json -Compress}
 'brightness_get' {$monitor=Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Select-Object -First 1;if(-not $monitor){throw 'Brightness is unavailable on this monitor.'};@{percent=$monitor.CurrentBrightness}|ConvertTo-Json -Compress}
 'brightness_set' {$before=(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness|Select-Object -First 1).CurrentBrightness;$m=Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods|Select-Object -First 1;if(-not $m){throw 'Brightness is unavailable on this monitor.'};$null=Invoke-CimMethod -InputObject $m -MethodName WmiSetBrightness -Arguments @{Timeout=1;Brightness=[byte]$Value};$after=(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness|Select-Object -First 1).CurrentBrightness;if($after-ne $Value){throw 'Brightness readback did not match.'};@{before=$before;after=$after;verified=$true}|ConvertTo-Json -Compress}
 'screenshot' {Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;$bounds=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;$image=[System.Drawing.Bitmap]::new($bounds.Width,$bounds.Height);$g=[System.Drawing.Graphics]::FromImage($image);try{$g.CopyFromScreen($bounds.Location,[System.Drawing.Point]::Empty,$bounds.Size);$image.Save($OutputPath,[System.Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$image.Dispose()};@{path=$OutputPath;saved=$true}|ConvertTo-Json -Compress}
 'restart' {shutdown.exe /r /t 10;if($LASTEXITCODE -ne 0){throw 'Restart request failed.'};@{requested='restart';delaySeconds=10}|ConvertTo-Json -Compress}
 'shutdown' {shutdown.exe /s /t 10;if($LASTEXITCODE -ne 0){throw 'Shutdown request failed.'};@{requested='shutdown';delaySeconds=10}|ConvertTo-Json -Compress}
}
