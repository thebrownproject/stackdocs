#!/bin/bash

# Stackdocs Local Deployment Script
# This script mimics what GitHub Actions will do on the server

set -e  # Exit on any error

echo "🚀 Stackdocs API - Local Deployment Script"
echo "============================================"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found!"
    echo "Creating template..."
    cat > .env.production << 'EOF'
ENVIRONMENT=production
DEBUG=False

# Supabase
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_service_role_key_here

# Clerk Authentication
CLERK_SECRET_KEY=sk_live_your_clerk_secret_key_here
CLERK_AUTHORIZED_PARTIES=https://www.stackdocs.io

# AI Services
MISTRAL_API_KEY=your_mistral_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CLAUDE_MODEL=claude-sonnet-4-20250514

# Application
APP_NAME=Stackdocs
APP_VERSION=1.0.0
ALLOWED_ORIGINS=https://www.stackdocs.io
EOF
    echo "✅ Template .env.production created!"
    echo "⚠️  Please update with your actual API keys and run again"
    exit 1
fi

echo "📁 Current directory:"
ls -la

echo ""
echo "🛑 Stopping existing container..."
docker-compose down 2>/dev/null || true

echo ""
echo "💻 System resources:"
free -m | head -2

echo ""
echo "🔧 Building container..."
docker-compose build --no-cache

echo ""
echo "🚀 Starting container..."
docker-compose up -d

echo ""
echo "⏳ Waiting for startup..."
sleep 10

echo ""
echo "📊 Container status:"
docker-compose ps
docker ps -a | grep stackdocs || echo "No stackdocs containers found"

echo ""
echo "📋 Container logs:"
docker-compose logs --tail=20

echo ""
echo "🌐 Testing health endpoint..."
if curl -f http://localhost:8000/health; then
    echo ""
    echo "✅ Deployment successful!"
    echo "🌐 API: http://localhost:8000"
    echo "📚 Docs: http://localhost:8000/docs"
else
    echo ""
    echo "❌ Health check failed!"
    echo "📋 Check logs above for details"
    docker-compose logs
    exit 1
fi