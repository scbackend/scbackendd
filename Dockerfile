FROM node:lts

WORKDIR /app

COPY . .

CMD ["bash", "-c", "npm link && scbackendd"]