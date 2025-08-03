# 1. Start with a standard Node.js base image
FROM node:18-slim

# 2. Install the necessary system dependencies for both Python and C++
# This includes python3, the g++ compiler, and the gdb debugger.
RUN apt-get update && apt-get install -y python3 build-essential gdb

# 3. Set the working directory inside the container
WORKDIR /app

# 4. Copy the package files and install Node.js dependencies
COPY package*.json ./
RUN npm install

# 5. Copy the rest of your backend application code
COPY . .

# 6. Expose the port that the server will run on
EXPOSE 3001

# 7. Define the command to start the server when the container starts
CMD [ "node", "server.js" ]