FROM metaligh/amneziawg

# Install Node.js
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package.json first for better Docker layer caching
COPY package.json ./

# Install Node.js dependencies
RUN npm install

# Copy application files
COPY WGUserManager.js ./
COPY server.js ./
COPY run.sh ./


EXPOSE 3000/tcp
EXPOSE 51820/udp

# Run as root (required for WireGuard operations)
USER root

# Default command
CMD ["./run.sh"]
