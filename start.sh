#!/bin/ash
Xvfb :99 -screen 0 1280x720x24&
x11vnc -forever &
export PULSE_SINK="roll20Sink"
pulseaudio -D --exit-idle-time=-1
export SINK_NAME="roll20Sink"
pacmd load-module module-null-sink sink_name=$SINK_NAME
pacmd update-sink-proplist $SINK_NAME device.description=$SINK_NAME
pacmd load-module module-loopback sink=$SINK_NAME
pm2-runtime "server.js"
