# -------- Stage 1: build the React bundle --------
FROM node:20-alpine AS builder
WORKDIR /app

# Bust npm cache only when package.json changes
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copy source and build
COPY . .

# Accept build-time API base (defaults to "/api" which matches the Nginx proxy)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# -------- Stage 2: serve with Nginx --------
FROM nginx:1.27-alpine AS runtime

# Swap in our SPA + reverse-proxy config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
