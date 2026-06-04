import express from 'express';
import crypto from 'crypto';
import * as jose from 'jose';
import jsonStableStringify from 'json-stable-stringify';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = express.Router();

// Load keys with error handling
function loadKeys() {
  const didPath = process.env.PUBLIC_KEY_FILE || path.join(os.homedir(), '.key', 'did.json');
  const jwkPath = process.env.PRIVATE_KEY_FILE || path.join(os.homedir(), '.key', 'key.json');
  
  if (!fs.existsSync(jwkPath) || !fs.existsSync(didPath)) {
    throw new Error(`Key files not found. Expected:\n- ${jwkPath}\n- ${didPath}`);
  }
  
  const jwk = JSON.parse(fs.readFileSync(jwkPath, 'utf-8'));
  const did = JSON.parse(fs.readFileSync(didPath, 'utf-8'));
  return { jwk, did };
}

let keys;
try {
  keys = loadKeys();
} catch (error) {
  console.error(`⚠️  Warning: ${error.message}`);
}

// Create VC endpoint
router.post('/vc/create', async (req, res) => {
  try {
    if (!keys) {
      return res.status(500).json({ error: 'Key files not configured. Please set up keys first.' });
    }

    const { subjectDid, claims } = req.body;

    // Validation
    if (!claims || Object.keys(claims).length === 0) {
      return res.status(400).json({ error: 'At least one claim is required' });
    }

    // Use provided DID or auto-generate
    const credentialSubjectId = subjectDid || `did:key:z${crypto.randomBytes(32).toString('hex').substring(0, 44)}`;

    // Build credential subject with claims
    const credentialSubject = {
      id: credentialSubjectId,
      ...claims,
    };

    // W3C VC structure
    const credential = {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://www.w3.org/ns/credentials/examples/v2',
      ],
      type: ['VerifiableCredential'],
      id: `urn:uuid:${crypto.randomUUID()}`,
      issuer: `${keys.did.id}`,
      issuanceDate: new Date().toISOString(),
      credentialSubject
    };

    // Sign the credential using JWS
    const privateKey = await jose.importJWK(keys.jwk);
    const signedJwt = await new jose.SignJWT(credential)
      .setProtectedHeader({ alg: keys.jwk.alg, iss: keys.did.id, kid: keys.jwk.kid })
      .sign(privateKey);

    // Ensure JWT is clean (no URLs, just the token)
    const cleanJwt = signedJwt.trim();

    res.json({
      success: true,
      data: {
        credential: credential,
        jwt: cleanJwt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vc/qrcode', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }

    const qrData = typeof data === 'string' ? data : jsonStableStringify(data);
    const qrCode = await QRCode.toDataURL(qrData);
    res.json({
      success: true,
      qrCode,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;