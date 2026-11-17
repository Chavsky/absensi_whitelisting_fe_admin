import express from 'express';
import path from 'path';

// Clean, minimal production server for serving built static files in deployment
// All simulation and mock API endpoints have been completely removed.
// The frontend connects to the official backend at VITE_API_BASE_URL.
const app = express();
// Optional standalone preview only. Production must serve the built app through
// the existing backend/reverse proxy; do not occupy the API's port 3000.
const PORT = Number(process.env.FRONTEND_PREVIEW_PORT) || 4173;

const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web Admin production static server listening on port ${PORT}`);
});
