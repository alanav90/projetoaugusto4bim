# 1. Usa uma imagem oficial do Node.js estável
FROM node:20-alpine

# 2. Cria a pasta do projeto dentro do container
WORKDIR /usr/src/app

# 3. Copia os arquivos de configuração de dependências
COPY package*.json ./

# 4. Instala as dependências (incluindo o dotenv, express, etc.)
RUN npm install

# 5. Copia o resto dos arquivos do projeto para dentro do container
COPY . .

# 6. Expõe a porta 3000 (que é a porta que seu server.js usa)
EXPOSE 3000

# 7. Comando para iniciar o servidor express
CMD [ "node", "server.js" ]