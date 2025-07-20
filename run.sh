#!/bin/bash
# Exit immediately if any command fails (non-zero exit status)
set -e

npm run init
# Start AmneziaWG interface
awg-quick up /data/awg0.conf

# Set up iptables for NAT masquerading
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# Start the Node.js application
node src/apiserver

while true; do
    sleep 1
done
