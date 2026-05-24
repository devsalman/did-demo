import express from 'express';
import crypto from 'crypto';
import * as jose from 'jose';
import jsonStableStringify from 'json-stable-stringify';
import fs from 'fs';

const router = express.Router();
const didPath = '/home/salman/.identitylab.id/key/did.json';
const jwkPath = '/home/salman/.identitylab.id/key/key_1779537506886.json';
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
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/2018/credentials/examples/v1',
      ],
      type: ['VerifiableCredential'],
      id: `urn:uuid:${crypto.randomUUID()}`,
      issuer: `${did.id}`,
      issuanceDate: new Date().toISOString(),
      credentialSubject
    };

    // Generate proof
    const privKey = await jose.importJWK(jwk, jwk.alg);
    const payload = jsonStableStringify(credential);
    const jws = await new jose.CompactSign(new TextEncoder().encode(payload))
        .setProtectedHeader({ alg: jwk.alg, kid: did.authentication[0], b64: false, crit: ['b64'] })
        .sign(privKey);

    const jwsParts = jws.split('.');
    const proof = {
      type: 'JsonWebSignature2020',
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: did.assertionMethod[0],
      jws: jwsParts[0] + '..' + jwsParts[2]
    };

    credential.proof = proof;

    res.json({
      success: true,
      credential,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;