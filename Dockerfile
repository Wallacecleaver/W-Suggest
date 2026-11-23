# Use an official Node.js image as the base
FROM node:18

# Create app directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Build SQLite ID database and remove raw 75MB JSON to save memory and image size
RUN node scripts/build-id-db.js && rm -f data/watchmode_title_id_map.json

EXPOSE 3000

# Start the app with optimized V8 memory limit
CMD ["node", "--max-old-space-size=256", "server.js"]
