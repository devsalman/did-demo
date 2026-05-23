import express from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { generateKeyPairSync } from 'crypto';
import { promisify } from 'util';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');

// In-memory storage for demo
const credentials = new Map(); // credentialId -> credential data
const issuers = new Map(); // issuerId -> issuer data
const holders = new Map(); // holderId -> holder data

// Generate a sample issuer on startup
function initializeSampleIssuer() {
  const issuerKey = {
    id: 'issuer-001',
    name: 'Identity Lab',
    did: 'did:web:identitylab.id',
    privateKey: null,
    publicKey: null,
  };
  issuers.set(issuerKey.id, issuerKey);
}

// Routes

// Home page - Demo interface
app.get('/', (req, res) => {
  res.render('index', {
    credentials: Array.from(credentials.values()),
    issuers: Array.from(issuers.values()),
    holders: Array.from(holders.values()),
  });
});

// Issue credential endpoint
app.post('/api/credential/issue', (req, res) => {
  const { subjectName, subjectEmail, credentialType, issuerName } = req.body;

  if (!subjectName || !credentialType || !issuerName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const issuer = Array.from(issuers.values()).find((i) => i.name === issuerName);
  if (!issuer) {
    return res.status(404).json({ error: 'Issuer not found' });
  }

  // Create verifiable credential
  const credentialId = `cred-${Date.now()}`;
  const issuanceDate = new Date().toISOString();

  const credential = {
    id: credentialId,
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://www.w3.org/2018/credentials/examples/v1',
    ],
    type: ['VerifiableCredential', credentialType],
    issuer: issuer.did,
    issuanceDate,
    credentialSubject: {
      id: `did:example:${subjectName.toLowerCase().replace(/\s+/g, '_')}`,
      name: subjectName,
      email: subjectEmail,
      credentialType,
    },
    status: 'issued',
    jwt: null, // Will be signed later
  };

  credentials.set(credentialId, credential);

  res.json({
    success: true,
    message: `Credential issued for ${subjectName}`,
    credential,
  });
});

// Sign credential endpoint
app.post('/api/credential/:id/sign', (req, res) => {
  const { id } = req.params;
  const credential = credentials.get(id);

  if (!credential) {
    return res.status(404).json({ error: 'Credential not found' });
  }

  if (credential.status === 'signed') {
    return res.status(400).json({ error: 'Credential already signed' });
  }

  // Create JWT signature (simplified for demo)
  const jwt = `eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
    JSON.stringify(credential),
  ).toString('base64')}.SIGNATURE_${Date.now()}`;

  credential.jwt = jwt;
  credential.status = 'signed';

  res.json({
    success: true,
    message: 'Credential signed',
    credential,
    jwt,
  });
});

// Verify credential endpoint
app.post('/api/credential/:id/verify', (req, res) => {
  const { id } = req.params;
  const credential = credentials.get(id);

  if (!credential) {
    return res.status(404).json({ error: 'Credential not found' });
  }

  if (credential.status !== 'signed') {
    return res.status(400).json({
      error: 'Credential must be signed before verification',
    });
  }

  // Simplified verification for demo
  const isValid = credential.jwt && credential.jwt.includes('SIGNATURE_');

  res.json({
    success: true,
    isValid,
    message: isValid ? 'Credential verification successful' : 'Invalid credential',
    credential,
  });
});

// Revoke credential endpoint
app.post('/api/credential/:id/revoke', (req, res) => {
  const { id } = req.params;
  const credential = credentials.get(id);

  if (!credential) {
    return res.status(404).json({ error: 'Credential not found' });
  }

  credential.status = 'revoked';
  credential.revokedAt = new Date().toISOString();

  res.json({
    success: true,
    message: 'Credential revoked',
    credential,
  });
});

// Get credential details endpoint
app.get('/api/credential/:id', (req, res) => {
  const { id } = req.params;
  const credential = credentials.get(id);

  if (!credential) {
    return res.status(404).json({ error: 'Credential not found' });
  }

  res.json(credential);
});

// Get all credentials endpoint
app.get('/api/credentials', (req, res) => {
  res.json(Array.from(credentials.values()));
});

// Initialize
initializeSampleIssuer();

// Start server
app.listen(PORT, () => {
  console.log(`✅ VC Demo Server running on http://localhost:${PORT}`);
  console.log(`📄 Open browser: http://localhost:${PORT}`);
});
