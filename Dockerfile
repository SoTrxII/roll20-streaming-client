# Transpile the typescript into plain Javacript, cache dependencies
FROM ubuntu:latest as build
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD 1
# install and cache app dependencies
COPY package.json /app/package.json
RUN npm install
# add app
COPY . /app
# generate build
RUN npm run build


############
### PROD ###
############
FROM ubuntu:latest
#Install
RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.11/main" >> /etc/apk/repositories \
    && apk upgrade -U -a \
    && apk add --no-cache \
    libstdc++ \
    chromium \
    harfbuzz \
    nss \
    freetype \
    ttf-freefont \
    wqy-zenhei \
    tini \
    fdk-aac \
    libxcb \
    #Virtual Display
    xvfb \
    #Virtual Audio
    pulseaudio \
    pulseaudio-dev \
    pulseaudio-utils \
    #Monitoring
    x11vnc \
    && rm -rf /var/cache/* \
    && mkdir /var/cache/apk

WORKDIR /app
# Run Chromium as non-privileged, running it as root makes it panic
RUN adduser -D roll20client \
    && chown -R roll20client:roll20client /app \
    && adduser roll20client pulse-access \
    && adduser roll20client audio \
    && adduser roll20client video

# Copy from previous stages the transpiled app and the custom FFMPEG build
COPY --from=build /app/dist /app
COPY --from=ffmpegbuilder --chown=roll20client:roll20client /root/bin/* /usr/local/bin/

#Actually install the production dependencies, and cleaning them up
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD 1
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser
RUN npm install -g pm2 \
    && npm install -g pm2 modclean \
    && npm install --only=prod \
    && modclean -r \
    && modclean -r /usr/local/lib/node_modules/pm2 \
    && npm uninstall -g modclean \
    && npm cache clear --force \
    && rm -rf /root/.npm /usr/local/lib/node_modules/npm


USER roll20client

# Preparing startup script
COPY --chown=roll20client:roll20client start.sh /app
RUN chmod u+x /app/start.sh


ENV DISPLAY :99
EXPOSE 5900
ENTRYPOINT ["tini", "--"]
CMD /app/start.sh
