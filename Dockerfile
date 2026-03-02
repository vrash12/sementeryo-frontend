FROM node:20-alpine AS build
WORKDIR /repo

# Copy root manifests (lockfile is here)
COPY package.json package-lock.json ./

# Copy workspace package.json so npm can resolve the workspace without copying all sources yet
COPY frontend/package.json ./frontend/package.json

# Install using the root lockfile (workspaces-aware)
RUN npm install

# Now copy the rest of the repo (or at least frontend)
COPY . .

# Build the frontend (pick ONE of these depending on how scripts are set up)
# Option 1: if root package.json has "workspaces": [...]
RUN npm --workspace frontend run build

# Option 2 (if your workspace name is different than folder), you may need:
# RUN npm --workspace <workspace-name> run build

FROM nginx:alpine
COPY --from=build /repo/frontend/dist /usr/share/nginx/html