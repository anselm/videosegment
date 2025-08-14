#!/bin/bash

# Test script for PM2 integration
echo "PM2 Integration Test"
echo "===================="

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if PM2 is installed
echo -e "\n${YELLOW}1. Checking PM2 Installation${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}✗ PM2 is not installed${NC}"
    echo "  Install with: npm install -g pm2"
    exit 1
fi

PM2_VERSION=$(pm2 --version)
echo -e "${GREEN}✓ PM2 installed: v$PM2_VERSION${NC}"

# Check if ecosystem file exists
echo -e "\n${YELLOW}2. Checking Ecosystem Config${NC}"
if [ -f "ecosystem.config.js" ]; then
    echo -e "${GREEN}✓ ecosystem.config.js found${NC}"
else
    echo -e "${RED}✗ ecosystem.config.js not found${NC}"
    exit 1
fi

# Check if app is built
echo -e "\n${YELLOW}3. Checking Build${NC}"
if [ -d "dist" ]; then
    echo -e "${GREEN}✓ Frontend is built${NC}"
else
    echo -e "${RED}✗ Frontend not built${NC}"
    echo "  Build with: npm run build"
    exit 1
fi

# Check FFmpeg service
echo -e "\n${YELLOW}4. Checking FFmpeg Service${NC}"
if curl -s -f "http://localhost:9020/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ FFmpeg service is running on port 9020${NC}"
else
    echo -e "${RED}✗ FFmpeg service is not accessible${NC}"
    echo "  Please ensure Docker services are running: npm run docker:start"
    exit 1
fi

# Test PM2 commands
echo -e "\n${YELLOW}5. Testing PM2 Commands${NC}"

# Stop if already running
if pm2 list 2>/dev/null | grep -q "videosegment-server"; then
    echo "  Stopping existing process..."
    npm run pm2:stop
    sleep 2
fi

# Start the app
echo "  Starting videosegment-server..."
npm run pm2:start

# Wait for startup
sleep 3

# Check if running
if pm2 list 2>/dev/null | grep -q "online.*videosegment-server"; then
    echo -e "${GREEN}✓ Server started successfully${NC}"
else
    echo -e "${RED}✗ Server failed to start${NC}"
    npm run pm2:logs
    exit 1
fi

# Test API endpoint
echo -e "\n${YELLOW}6. Testing API Endpoint${NC}"
if curl -s -f "http://localhost:3001/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API is responding${NC}"
else
    echo -e "${RED}✗ API is not responding${NC}"
    echo "  Check logs with: npm run pm2:logs"
fi

# Show process info
echo -e "\n${YELLOW}7. Process Information${NC}"
pm2 info videosegment-server | grep -E "(status|uptime|restarts|memory|cpu)" | head -10

echo -e "\n${GREEN}PM2 Test Complete!${NC}"
echo ""
echo "Useful commands:"
echo "  npm run pm2:logs         # View logs"
echo "  npm run pm2:monit        # Monitor performance"
echo "  npm run pm2:restart      # Restart server"
echo "  npm run pm2:stop         # Stop server"
echo "  npm run pm2:delete       # Remove from PM2"
