#!/bin/bash

# Start AmneziaWG interface
awg-quick up awg0

# Set up iptables for NAT masquerading
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# Start the Node.js application
node server.js
