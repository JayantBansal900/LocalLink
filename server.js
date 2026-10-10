import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';
import { initAuth } from './services/authService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const pagesDir = path.join(__dirname, 'pages');
const legacyCommunityDir = path.join(pagesDir, 'community', 'legacy');
const legacyConsumerDir = path.join(pagesDir, 'consumer', 'legacy', 'street-vendors');

// Initialize Auth default seed accounts
initAuth();

// Body parsing and cookie middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Catch JSON body parsing errors and return clean structured JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body'
    });
  }
  next(err);
});

// REST API routes
app.use('/api', apiRoutes);

// --- Semantic Clean URLs ---
app.get('/services', (req, res) => {
  res.sendFile(path.join(pagesDir, 'consumer', 'consumer.html'));
});

app.get('/community', (req, res) => {
  res.sendFile(path.join(pagesDir, 'community', 'community.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(pagesDir, 'dashboard', 'dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(pagesDir, 'admin', 'admin.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(pagesDir, 'contact', 'contact.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(pagesDir, 'auth', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(pagesDir, 'auth', 'signup.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(pagesDir, 'dashboard', 'profile.html'));
});

app.get('/provider/:id', (req, res) => {
  res.sendFile(path.join(pagesDir, 'dashboard', 'profile.html'));
});

app.get('/profile/:id', (req, res) => {
  res.sendFile(path.join(pagesDir, 'dashboard', 'profile.html'));
});

// Clean Issue Routes
app.get('/issue/:id', (req, res) => {
  res.sendFile(path.join(pagesDir, 'community', 'issue-detail.html'));
});

app.get('/issues/:id', (req, res) => {
  res.redirect(`/issue/${req.params.id}`);
});

// Home Aliases
app.get('/home', (req, res) => {
  res.redirect('/');
});

app.get('/HomePage/home.html', (req, res) => {
  res.redirect('/');
});

// Legacy form post targets
app.post('/consumer-signup', (req, res) => {
  res.redirect('/services');
});

app.post('/vendor-signup', (req, res) => {
  res.redirect('/services');
});

// Backward-compatible redirects for legacy prototype paths
app.get('/consmermodeeng1.html', (req, res) => {
  res.redirect('/services');
});

app.get('/basiccomunitymode.html', (req, res) => {
  res.redirect('/community');
});

app.get('/contactus.html', (req, res) => {
  res.redirect('/contact');
});

app.get('/signup.html', (req, res) => {
  res.redirect('/signup');
});

app.get('/login.html', (req, res) => {
  res.redirect('/login');
});

app.get('/consumermode/consumereng.html', (req, res) => {
  res.redirect('/services');
});

app.get('/consumermodeeng.html/consumereng.html', (req, res) => {
  res.redirect('/services');
});

app.get('/consumermodeeng.html/firstconsumereng.html', (req, res) => {
  res.redirect('/services');
});

app.get('/consumermodeeng.html/street-vendors.html', (req, res) => {
  res.sendFile(path.join(legacyConsumerDir, 'street-vendors.html'));
});

const legacyCommunityPages = [
  'air-pollution',
  'garbage-disposal',
  'plantation',
  'potholes',
  'power-cuts',
  'public-transport',
  'street-vendors',
  'water-supply'
];

legacyCommunityPages.forEach((page) => {
  app.get(`/${page}.html`, (req, res) => {
    res.sendFile(path.join(legacyCommunityDir, `${page}.html`));
  });
});

app.get('/profile1plumber.html', (req, res) => {
  res.redirect('/profile/1');
});

app.get('/profile2elect.html', (req, res) => {
  res.redirect('/profile/2');
});

app.get('/profile3carpenter.html', (req, res) => {
  res.redirect('/profile/3');
});

// Serve only intentionally public assets.
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Explicit route for root entry
app.get('/', (req, res) => {
  res.sendFile(path.join(pagesDir, 'home', 'index.html'));
});

// Global API error handler ensuring structured JSON without stack traces
app.use((err, req, res, next) => {
  if (req.path.startsWith('/api') || req.xhr || req.headers.accept?.includes('json')) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'An internal server error occurred'
    });
  }
  next(err);
});

// 404 Fallback
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(pagesDir, 'home', 'index.html'));
  } else {
    res.status(404).json({ success: false, message: 'Resource not found' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LocalLink server running at http://localhost:${PORT}`);
});
