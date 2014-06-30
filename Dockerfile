FROM stackbrew/ubuntu:latest

EXPOSE 80

RUN apt-get update
RUN apt-get install -y wget git
RUN wget -O - http://nodejs.org/dist/v0.10.25/node-v0.10.25-linux-x64.tar.gz | tar -C /usr/local/ --strip-components=1 -zxv

RUN npm i -g bower http-server

ADD ./ /data/app

WORKDIR /data/app/
RUN bower link --allow-root

WORKDIR /data/app/prototype
RUN bower link hue --allow-root
CMD http-server -p 80
