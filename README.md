Zonos
=====

A simple Chrome application to control your Sonos systems.

Zonos lets you control your Sonos systems (play, pause, volume, etc.). It does not currently allow
you to browse your music library. It's particulary useful to control your Sonos from platforms
that don't currently have a native Sonos application (such as Linux or Google Chromebooks). It
should work on any recent version of Google Chrome.

![Zonos](/screenshot.png?raw=true)

This application may also be used as an example for developping other UPnP clients for Chrome.

### Installation

1. Download the application and extract the .zip file to a folder of your choice:

 https://github.com/siboulet/zonos/archive/master.zip

2. From Chrome, go to Settings, and select Extensions for the left menu. Click the "Load unpacked
extension..." at the top and point it to the folder where you extracted Zonos.

### Known Issues

1. Firewall on Chromebook

 Zonos uses port TCP/3400 for receiving events from the Sonos system (as per Sonos documentation).
 Currently, it is not possible to open the firewall on Google Chromebook. There is an issue opened
 with the Chrome team to implement this feature on the Chromebook. Please vote for this feature by
 "staring" the issue here:

 https://code.google.com/p/chromium/issues/detail?id=233052

 If you want to use Zonos on a Google Chromebook, you will need to enter developer mode on your
 Chromebook and manually open port TCP/3400.

2. No longer working after long periods of inactivity

 If Zonos suddenly stops receiving events / controlling your Sonos system, right click the Zonos
 window and choose "Reload App". I have not investigated the issue but I suspect it has something
 to do with the UPnP SUBSCRIBE which has a timeout of 3600 seconds (1 hour).

### References

* http://forums.sonos.com/showthread.php?t=14719
* http://forums.sonos.com/showthread.php?t=34484
* http://blog.travelmarx.com/2010/06/exploring-sonos-via-upnp.html

### Logo and Icons
Zonos Logo from HydroPro Set by Ben Fleming: http://mediadesign.deviantart.com/art/HydroPRO-HP-Dock-Icon-Set-71776088
Licensed under the Creative Commons Attribution-Noncommercial-Share Alike 3.0 License.

Icons from GLYPHICONS, used under license.
Licensed under the GLYPHICONS license, see /glyphicons/LICENSE.
