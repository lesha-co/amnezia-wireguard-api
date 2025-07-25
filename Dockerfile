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
COPY . .

RUN rm awgstart awguser readme serverip.cfg vpn_params.cfg


# Run as root (required for WireGuard operations)
USER root

# Default command
CMD ["./run.sh"]
