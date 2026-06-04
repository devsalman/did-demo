import express from 'express';
import { generateKeyPairSync, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import frontendRoutes from './routes/frontend.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');

// Serve static files from the "public" directory
app.use(express.static('public'));

// Application Routes
app.use('/', frontendRoutes);
app.use('/', authRoutes);
app.use('/api/', apiRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ SSI VC Issuer running on http://localhost:${PORT}`);
  console.log(`🔑 Issuer DID: did:web:identitylab.id`);
  console.log(`📄 VC Demo: http://localhost:${PORT}`);
  console.log(`🔐 SIOP Login: http://localhost:${PORT}/login\n`);
});

