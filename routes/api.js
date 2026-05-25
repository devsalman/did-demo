import express from 'express';
import crypto from 'crypto';
import * as jose from 'jose';
import jsonStableStringify from 'json-stable-stringify';
import fs from 'fs';

const router = express.Router();
const didPath = process.env.PUBLIC_KEY_FILE || '~/.key/did.json';
const jwkPath = process.env.PRIVATE_KEY_FILE || '~/.key/key.json';
const jwk = JSON.parse(fs.readFileSync(jwkPath, 'utf-8'));
const did = JSON.parse(fs.readFileSync(didPath, 'utf-8'));

// Create VC endpoint
router.post('/vc/create', async (req, res) => {
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
        'https://www.w3.org/ns/credentials/v2',
        'https://www.w3.org/ns/credentials/examples/v2',
      ],
      type: ['VerifiableCredential'],
      id: `urn:uuid:${crypto.randomUUID()}`,
      issuer: `${did.id}`,
      issuanceDate: new Date().toISOString(),
      credentialSubject
    };

    // Sign the credential using JWS
    const privateKey = await jose.importJWK(jwk);
    const signedJwt = await new jose.SignJWT(credential)
      .setProtectedHeader({ alg: jwk.alg, iss: did.id, kid: jwk.kid })
      .sign(privateKey);

    res.json({
      success: true,
      data: {
        credential: credential,
        jwt: signedJwt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vc/qrcode', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Credential is required' });
    }

    const qrData = jsonStableStringify(credential);
    const qrCode = qrcoede.toDataURL(qrData);
    res.json({
      success: true,
      qrCode,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;