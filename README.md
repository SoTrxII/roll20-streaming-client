# Roll 20 streaming client

A remote-controlled Roll20 client used to stream roll20 audio and video feeds to an 
RTMP server (Youtube, Twitch, or a custom one).

This is something I created to record some tabletop RPG games. 
This is used along with [Pandora](https://github.com/SoTrxII/Pandora) to record both audio/video from Roll20 and audio
from Discord, to be later on mixed together.

## Features 
 + Join Roll20 games using a user account.
 + Stream (audio and video) the game to any RTMP compatible server 
 + Tweaking Roll20 UI to maximize field view, removing any unnecessary UI widget for a recording, 
 such as Zoom Level adjustment or drawing tools
 + Dynamically change the subset of the field recorded and zoom level.
 ![zoom](assets/images/zoom.gif)
 
## Principle

The program is creating its own virtual screen using [Xvfb](https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml).
Using Xvfb allows for headless devices such as VPS to run this script.

[Puppeteer](https://github.com/puppeteer/puppeteer) is then used to navigate through Roll20 menus and join games.

All communications are handled via Redis.


## Using the project

### Requirements
 
#### Pulseaudio 
First, a dedicated Pulseaudio sink must be created. The Chromium instance will dump all sound in this Sink.
Using a dedicated sink allows for multiple sound-enabled applications running at the same time without conflicts.
```sh 
# This is only a temporary sink 
# You can edit pulseaudio config or add a startup script to make it persistent
SINK_NAME="roll20Sink"
pacmd load-module module-null-sink sink_name=$SINK_NAME
pacmd update-sink-proplist $SINK_NAME device.description=$SINK_NAME
pacmd load-module module-loopback sink=$SINK_NAME
```

#### Redis

A Redis instance is used to handle communications. 

### Running the program

```sh
# In the project root diretory
npm install
npm build 
# Removing devdependencies once the build process is done
npm prune --production  && npm install dotenv-safe
npm start:dev
```
Once you've reached this step, a chrome instance should be up and running, already logged in using the credentials you
provided.

## About Docker 

Although I'm a big fan of Docker, and there is a Dockerfile provided, **Docker shouldn't be used** to run 
this project at this state. The reason is Pulseaudio, the sound server currently used. Pulseaudio doesn't play nicely 
when used within a container.
Sharing the host Pulseaudio via a cookie is pretty unstable, and the cookie would sometimes just timeout for no reason.
I'm currently experimenting with sharing it over the network, or even going back to ALSA.    
