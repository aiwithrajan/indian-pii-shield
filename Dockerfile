# Multi-Stage Dockerfile for Indian-PII Shield
# Builds React frontend and serves both UI + API in a high-performance Python container

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime Python Image
FROM python:3.9-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=frontend-builder /app/dist /app/dist

EXPOSE 8080

CMD ["sh", "-c", "uvicorn pii_shield.proxy:app --host 0.0.0.0 --port ${PORT:-8080}"]
