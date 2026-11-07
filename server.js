import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import api from './src/server/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Mount API routes
app.use(api);

// Serve frontend static assets
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).send('Please run `npm run build` first to generate static files.');
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[NETFLEX Engine] Running on http://localhost:${PORT}`);
});
