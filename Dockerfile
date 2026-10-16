# Multi-Stage Dockerfile for Indian-PII Shield
# Stage 1: Build React 18 Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Python 3.11 Runtime
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# Install build dependencies for C-extensions and wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    g++ \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip, setuptools and wheel to support modern binary wheels
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download lightweight spacy model (optional, falls back safely if skipped)
RUN python -m spacy download en_core_web_sm || true

COPY . .
COPY --from=frontend-builder /app/dist /app/dist

EXPOSE 8080

CMD ["sh", "-c", "uvicorn pii_shield.proxy:app --host 0.0.0.0 --port ${PORT:-8080}"]
