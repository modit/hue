FROM stackbrew/ubuntu:latest

RUN apt-get update
RUN apt-get install -y wget
RUN wget -O - http://nodejs.org/dist/v0.10.25/node-v0.10.25-linux-x64.tar.gz | tar -C /usr/local/ --strip-components=1 -zxv

ADD . /data/app
WORKDIR /data/app

RUN npm install > /dev/null 2>&1

CMD npm start
