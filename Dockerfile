#############
### build ###
#############
# base image
FROM node:14 as build
# set working directory
WORKDIR /app
# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH
# install and cache app dependencies
COPY package.json /app/package.json 

RUN npm install
# add app
COPY . /app
# generate build
RUN npm run build
############
### prod ###
############
FROM node:latest

# update and add all the steps for running with xvfb
RUN apt-get update &&\
apt-get install -yq gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget \
x11vnc x11-xkb-utils xfonts-100dpi xfonts-75dpi xfonts-scalable xfonts-cyrillic x11-apps xvfb pulseaudio

# add the required dependencies
WORKDIR /app
COPY --from=build /app/dist /app
RUN npm install -g pm2 && npm install --only=prod

# Finally copy the build application
#COPY dist /app/dist

# make sure we can run without a UI
ENV DISPLAY :99
EXPOSE 3000
ADD start.sh /app
RUN chmod +x /app/start.sh
CMD /app/start.sh
