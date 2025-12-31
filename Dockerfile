# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY . .

ARG VITE_API_BASE_URL
ARG VITE_API_BASE_URL_IMAGE
ARG VITE_GOOGLE_MAPS_API_KEY

# ✅ must be available during `npm run build`
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_BASE_URL_IMAGE=$VITE_API_BASE_URL_IMAGE
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

RUN npm ci
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
