# Stackdocs Deployment Guide

This guide explains how to deploy the Stackdocs FastAPI backend to your DigitalOcean VPS using the GitHub Actions CI/CD pipeline.

## 📋 Overview

**Deployment Architecture:**
- **GitHub Actions**: Automated CI/CD pipeline
- **DigitalOcean VPS**: Production server with Docker
- **Docker**: Containerized deployment for consistency
- **FastAPI**: Python web framework running in container

## 🔧 Setup Requirements

### 1. GitHub Repository Secrets

Add these secrets to your Stackdocs GitHub repository:

```bash
DROPLET_IP=your_droplet_ip_address
SSH_USER=your_ssh_username (usually root or your_user)
SSH_PRIVATE_KEY=your_ssh_private_key_content
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
MISTRAL_API_KEY=your_mistral_ocr_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
CLAUDE_MODEL=claude-sonnet-4-20250514
```

**How to add secrets:**
1. Go to your Stackdocs repository on GitHub
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret individually

### 2. VPS Requirements

Ensure your DigitalOcean droplet has:
- ✅ Docker installed (you mentioned you have this)
- ✅ Docker Compose installed
- ✅ Sufficient disk space (2GB+ free)
- ✅ Open port 8000 (or configured nginx reverse proxy)

## 🚀 Deployment Process

### Automatic Deployment (CI/CD)

**Triggers:**
- Push to `main` branch
- Only when `backend/**` files change

**What happens automatically:**

1. **Code Checkout**: GitHub pulls latest code
2. **File Transfer**: SCP copies backend files to VPS
3. **Environment Setup**: Creates `.env.production` with secrets
4. **Container Build**: Builds Docker image with latest code
5. **Deployment**: Stops old container, starts new one
6. **Health Check**: Verifies API responds correctly
7. **Logging**: Shows deployment logs and container status

### Manual Deployment (Local Testing)

For testing before pushing to main:

```bash
# 1. Clone repository
git clone <your-stackdocs-repo>
cd stackdocs/backend

# 2. Create production environment file
cp .env.production.example .env.production
# Edit .env.production with your actual API keys

# 3. Run deployment script
./deploy.sh
```

## 📁 File Structure

```
backend/
├── Dockerfile              # Container definition
├── docker-compose.yml      # Container orchestration
├── requirements.txt        # Python dependencies
├── .dockerignore          # Files to exclude from build
├── deploy.sh             # Manual deployment script
└── app/
    ├── main.py           # FastAPI application entry point
    ├── config.py         # Configuration settings
    ├── models.py         # Data models
    └── ...
```

## 🔍 Monitoring & Troubleshooting

### Check Deployment Status

```bash
# SSH into your droplet
ssh your_user@your_droplet_ip

# Check containers
docker ps -a | grep stackdocs

# View logs
docker-compose logs -f stackdocs-api

# Check system resources
docker stats
```

### Common Issues

**1. Container Won't Start**
```bash
# Check logs
docker-compose logs

# Common causes:
# - Missing API keys in .env.production
# - Port 8000 already in use
# - Docker daemon issues
```

**2. Health Check Fails**
```bash
# Test endpoint manually
curl http://localhost:8000/health

# Check if service is running
docker-compose ps
```

**3. Build Fails**
```bash
# Check Docker daemon
docker version

# Clear build cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

### Rollback Strategy

If deployment fails, you can quickly rollback:

```bash
# SSH into droplet
ssh your_user@your_droplet_ip

# Rollback to previous version
cd /opt/stackdocs-api
git log --oneline -5  # Find previous commit
git checkout <previous_commit_hash>
./deploy.sh
```

## 🌐 Accessing Your API

After successful deployment:

- **API URL**: `http://your_droplet_ip:8000`
- **Health Check**: `http://your_droplet_ip:8000/health`
- **API Documentation**: `http://your_droplet_ip:8000/docs`
- **API Endpoints**:
  - `POST /api/process` - Upload and process document
  - `POST /api/re-extract` - Re-extract with new parameters

## 🔄 CI/CD Best Practices

**For smooth deployments:**

1. **Test Locally First**: Use `./deploy.sh` to test
2. **Use Feature Branches**: Push to development branches first
3. **Check GitHub Actions**: Monitor workflow runs in repository
4. **Monitor Logs**: Check both GitHub Actions logs and server logs
5. **Keep Secrets Secure**: Never commit API keys to repository

## 📊 Performance Optimization

**Container Resources:**
- Default: 1 worker process
- Scale: Modify `uvicorn --workers` in Dockerfile if needed
- Memory: FastAPI + dependencies typically use <512MB

**VPS Scaling:**
- Monitor: `docker stats` for resource usage
- Upgrade: Consider larger droplet if CPU/memory bottlenecks

## 🎯 Next Steps

1. **Add Monitoring**: Consider adding health check alerts
2. **Setup Nginx**: Reverse proxy for production URLs
3. **SSL Certificate**: HTTPS for production use
4. **Backup Strategy**: Regular database and file backups
5. **Frontend Integration**: Connect Next.js frontend to deployed API

## 🆘 Support

If you encounter issues:

1. Check GitHub Actions logs first
2. Verify VPS container logs
3. Confirm all secrets are set correctly
4. Test API endpoints manually with curl

---

**Deployment Status**: ✅ Ready for production deployment
**Last Updated**: $(date)