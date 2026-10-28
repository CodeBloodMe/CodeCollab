#!/bin/bash
# ==============================================================================
# CodeForge AWS ALB Round-Robin Verification Prober (Bash)
# Sends sequential probes to verify load balancing between Server 1 and Server 2
# ==============================================================================

ALB_URL="${1:-http://localhost:5000}"
COUNT="${2:-10}"

echo "===================================================================="
echo " AWS Application Load Balancer Round-Robin Probe"
echo " Target URL : $ALB_URL/api/health"
echo " Iterations : $COUNT"
echo "===================================================================="

server1_hits=0
server2_hits=0
other_hits=0

printf "%-6s | %-10s | %-26s | %-12s | %-8s\n" "Req #" "Status" "Instance ID" "Zone" "Time"
echo "--------------------------------------------------------------------"

for i in $(seq 1 $COUNT); do
    response=$(curl -s -i "$ALB_URL/api/health?probe_seq=$i&t=$(date +%s%N)")
    
    status_code=$(echo "$response" | grep -m 1 -E "^HTTP" | awk '{print $2}' | tr -d '\r')
    instance_id=$(echo "$response" | grep -i -m 1 "x-instance-id:" | awk -F': ' '{print $2}' | tr -d '\r\n ')
    az_zone=$(echo "$response" | grep -i -m 1 "x-availability-zone:" | awk -F': ' '{print $2}' | tr -d '\r\n ')
    
    # Fallback to JSON body if reverse proxy strips custom headers
    if [ -z "$instance_id" ]; then
        instance_id=$(echo "$response" | grep -o '"instance_id":"[^"]*' | cut -d'"' -f4)
    fi
    if [ -z "$az_zone" ]; then
        az_zone=$(echo "$response" | grep -o '"availability_zone":"[^"]*' | cut -d'"' -f4)
    fi

    if [ -z "$instance_id" ]; then
        instance_id="unknown"
    fi
    if [ -z "$az_zone" ]; then
        az_zone="n/a"
    fi

    if [[ "$instance_id" == *"server1"* ]]; then
        ((server1_hits++))
    elif [[ "$instance_id" == *"server2"* ]]; then
        ((server2_hits++))
    else
        ((other_hits++))
    fi

    printf "#%-5d | HTTP %-5s | %-26s | %-12s | %s\n" "$i" "$status_code" "$instance_id" "$az_zone" "$(date +%H:%M:%S)"
    sleep 0.2
done

echo "===================================================================="
echo " Round-Robin Verification Summary"
echo "===================================================================="
echo " Total Requests Sent  : $COUNT"
echo " Server 1 Hits (AZ A) : $server1_hits"
echo " Server 2 Hits (AZ B) : $server2_hits"
if [ $other_hits -gt 0 ]; then
    echo " Other / Unlabeled    : $other_hits"
fi

if [ $server1_hits -gt 0 ] && [ $server2_hits -gt 0 ]; then
    echo " RESULT: PASS -> Load is successfully distributed across both Availability Zones!"
else
    echo " RESULT: NOTICE -> Traffic was only routed to one instance. Check ALB target health."
fi
echo "===================================================================="
