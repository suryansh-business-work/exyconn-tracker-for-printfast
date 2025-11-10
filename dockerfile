# Use Ubuntu as the base image
FROM ubuntu:24.04

# Install curl and other dependencies
RUN apt-get update && \
    apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest

# Verify Node.js version
RUN node -v && npm -v

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose your app port (change if needed)
EXPOSE 4002

# Build on every container start, then run the app
CMD npm run start