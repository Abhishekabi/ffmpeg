const express = require('express');
const path = require('path');
const compression = require('compression');
const app = express();

// Enable compression
app.use(compression());

// Cache static assets
const oneDay = 86400000;
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: oneDay,
    etag: true,
    lastModified: true
}));

// Security headers
app.use((req, res, next) => {
    // Required for SharedArrayBuffer
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    
    // Additional security and performance headers
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Origin-Agent-Cluster', '?1');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    next();
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 