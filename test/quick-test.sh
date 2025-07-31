#!/bin/bash

# Quick test to verify the system is ready
echo "Video Transcription App - Quick System Check"
echo "==========================================="

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Node.js
echo -e "\n${YELLOW}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js installed: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js not found. Please install Node.js 16+${NC}"
    exit 1
fi

# Check Docker
echo -e "\n${YELLOW}Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        echo -e "${GREEN}✓ Docker is running${NC}"
    else
        echo -e "${RED}✗ Docker is installed but not running. Please start Docker.${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Docker not found. Please install Docker.${NC}"
    exit 1
fi

# Check WhisperX container
echo -e "\n${YELLOW}Checking WhisperX service...${NC}"
if docker ps | grep -q whisperx-api; then
    echo -e "${GREEN}✓ WhisperX is running on port 9010${NC}"
else
    echo -e "${YELLOW}! WhisperX is not running${NC}"
    echo "  Start it with: npm run docker:whisper:start"
fi

# Check if server is built
echo -e "\n${YELLOW}Checking build status...${NC}"
if [ -d "dist" ]; then
    echo -e "${GREEN}✓ Frontend is built${NC}"
else
    echo -e "${YELLOW}! Frontend not built yet${NC}"
    echo "  Build with: npm run build"
fi

# Check environment
echo -e "\n${YELLOW}Checking environment...${NC}"
if [ -f ".env" ]; then
    if grep -q "ANTHROPIC_API_KEY" .env; then
        echo -e "${GREEN}✓ .env file exists with ANTHROPIC_API_KEY${NC}"
    else
        echo -e "${YELLOW}! .env file exists but ANTHROPIC_API_KEY not found${NC}"
        echo "  Add your Claude API key to .env file"
    fi
else
    echo -e "${YELLOW}! No .env file found${NC}"
    echo "  Create one with: echo 'ANTHROPIC_API_KEY=your_key_here' > .env"
fi

echo -e "\n${GREEN}Quick Start Commands:${NC}"
echo "1. npm install                    # Install dependencies"
echo "2. npm run docker:whisper:start   # Start WhisperX"
echo "3. npm run build:serve            # Build and start the app"
echo ""
echo "Then open http://localhost:3001 in your browser"
