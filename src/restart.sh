#!/bin/bash
awg-quick down awg0 > /dev/null 2>&1
awg-quick up awg0 2>&1 | grep -E '(^#|\[)'
ip a
awg show
