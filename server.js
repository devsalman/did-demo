import express from 'express';
import { generateKeyPairSync, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');

// Generate Ed25519 keypair and DID on startup
function generateIssuerDID() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  
  // Generate multibase-encoded did:key (simplified - just use random base58-like string)
  const randomSuffix = randomBytes(32).toString('hex').substring(0, 44);
  const did = `did:key:z${randomSuffix}`;
  
  return {
    did,
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }),
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }),
  };
}

// Initialize issuer keys on startup
const issuerKeys = generateIssuerDID();

// Helper to generate DID:key
function generateDidKey() {
  const randomSuffix = randomBytes(32).toString('hex').substring(0, 44);
  return `did:key:z${randomSuffix}`;
}

// Helper to generate simulated Ed25519 signature (base58-like)
function generateSimulatedProofValue() {
  const randomBytes_ = randomBytes(64).toString('hex');
  return `z${randomBytes_.substring(0, 88)}`;
}

// Routes

// Home page
app.get('/', (req, res) => {
  res.render('index');
});

// Create VC endpoint
app.post('/api/vc/create', (req, res) => {
  try {
    const { subjectDid, claims } = req.body;

    // Validation
    if (!claims || Object.keys(claims).length === 0) {
      return res.status(400).json({ error: 'At least one claim is required' });
    }

    // Use provided DID or auto-generate
    const credentialSubjectId = subjectDid || generateDidKey();

    // Build credential subject with claims
    const credentialSubject = {
      id: credentialSubjectId,
      ...claims,
    };

    // W3C VC structure
    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/2018/credentials/examples/v1',
      ],
      type: ['VerifiableCredential'],
      id: `urn:uuid:${uuidv4()}`,
      issuer: issuerKeys.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject,
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        verificationMethod: `${issuerKeys.did}#key-1`,
        proofPurpose: 'assertionMethod',
        proofValue: generateSimulatedProofValue(),
      },
    };

    res.json({
      success: true,
      credential,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ SSI VC Issuer running on http://localhost:${PORT}`);
  console.log(`🔑 Issuer DID: ${issuerKeys.did}`);
  console.log(`📄 Open browser: http://localhost:${PORT}\n`);
});
