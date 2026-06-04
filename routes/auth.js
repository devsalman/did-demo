import express from 'express';
import * as jose from 'jose';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

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

// In-memory session store (use Redis/DB in production)
const sessions = new Map();
const requestObjects = new Map(); // Store request JWTs for request_uri method

// SIOP Request Object endpoint - hosts the signed JWT
router.get('/api/auth/request/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const requestJwt = requestObjects.get(sessionId);
  
  if (!requestJwt) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  res.setHeader('Content-Type', 'application/oauth-authz-req+jwt');
  res.send(requestJwt);
});

// SIOP Request Object endpoint
router.post('/api/auth/siop-request', async (req, res) => {
  try {
    if (!keys) {
      return res.status(500).json({ error: 'Key files not configured' });
    }

    const sessionId = uuidv4();
    const nonce = uuidv4();
    const state = uuidv4();

    // Store session for callback verification
    sessions.set(sessionId, {
      nonce,
      state,
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 min expiry
    });

    // SIOP v2 Authorization Request (per spec)
    const authRequest = {
      client_id: 'did:web:identitylab.id',
      redirect_uri: 'https://demo.identitylab.id/auth/callback',
      response_type: 'vp_token id_token',
      response_mode: 'direct_post',
      nonce,
      state,
      presentation_definition: {
        id: 'academic_credential_request',
        input_descriptors: [
          {
            id: 'academic_credential',
            name: 'Academic Credential',
            purpose: 'Prove your academic credentials to login',
            format: {
              jwt_vc: {
                alg: ['EdDSA', 'ES256'],
              },
            },
            constraints: {
              fields: [
                {
                  path: ['$.credentialSubject.degree'],
                  filter: { type: 'string' },
                },
                {
                  path: ['$.issuer'],
                  filter: { const: 'did:web:identitylab.id' },
                },
              ],
            },
          },
        ],
      },
    };

    // Sign the request object with issuer's private key
    const privateKey = await jose.importJWK(keys.jwk);
    const requestJwt = await new jose.SignJWT(authRequest)
      .setProtectedHeader({ alg: keys.jwk.alg, typ: 'JWT', kid: `did:web:identitylab.id#key-1` })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    // Store the request JWT for request_uri method
    requestObjects.set(sessionId, requestJwt);

    // SIOP v2 spec: use request_uri method (not embedding JWT in QR)
    const requestUri = `https://demo.identitylab.id/api/auth/request/${sessionId}`;
    const siopUri = `siopv2://?client_id=${encodeURIComponent('did:web:identitylab.id')}&request_uri=${encodeURIComponent(requestUri)}&nonce=${encodeURIComponent(nonce)}`;

    res.json({
      sessionId,
      siopUri,
      requestUri,
      requestJwt, // Also return for debugging
    });
  } catch (error) {
    console.error('SIOP Request Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Callback endpoint to handle SIOP response
router.post('/auth/callback', async (req, res) => {
  try {
    const { vp_token, id_token, state } = req.body;

    if (!vp_token || !state) {
      return res.status(400).json({ error: 'Missing vp_token or state' });
    }

    // Verify session exists and is valid
    const session = sessions.get(state);
    if (!session || session.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Decode and verify VP token (without verification for now - in prod, verify signature)
    const vpDecoded = jose.decodeJwt(vp_token);
    const idTokenDecoded = id_token ? jose.decodeJwt(id_token) : null;

    // Extract credential from presentation
    let credential = null;
    let credentialSubject = null;

    if (vpDecoded.verifiablePresentation) {
      const presentation = vpDecoded.verifiablePresentation;
      if (Array.isArray(presentation.verifiableCredential) && presentation.verifiableCredential.length > 0) {
        // Decode the first credential
        const credJwt = presentation.verifiableCredential[0];
        const credDecoded = jose.decodeJwt(credJwt);
        credential = credDecoded;
        credentialSubject = credDecoded.credentialSubject;
      }
    }

    // Verify nonce matches
    if (vpDecoded.nonce !== session.nonce) {
      return res.status(401).json({ error: 'Nonce mismatch' });
    }

    // Create user session
    const userSession = {
      id: uuidv4(),
      authenticated: true,
      did: credentialSubject?.id || idTokenDecoded?.sub,
      degree: credentialSubject?.degree,
      institution: credentialSubject?.institution,
      name: credentialSubject?.name,
      issuer: credential?.issuer,
      issuedAt: credential?.issuanceDate,
      vpToken: vp_token,
      idToken: id_token,
      authenticatedAt: new Date().toISOString(),
    };

    // Store session (use Redis in production)
    sessions.set(userSession.id, userSession);

    // Clean up auth session
    sessions.delete(state);

    // Redirect to dashboard with session token
    res.json({
      success: true,
      sessionToken: userSession.id,
      user: {
        did: userSession.did,
        name: userSession.name,
        degree: userSession.degree,
        institution: userSession.institution,
      },
    });
  } catch (error) {
    console.error('Callback Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify session endpoint
router.get('/api/auth/verify', (req, res) => {
  const sessionToken = req.query.token;
  
  if (!sessionToken) {
    return res.status(401).json({ authenticated: false });
  }

  const session = sessions.get(sessionToken);
  if (!session || !session.authenticated) {
    return res.status(401).json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: {
      did: session.did,
      name: session.name,
      degree: session.degree,
      institution: session.institution,
      authenticatedAt: session.authenticatedAt,
    },
  });
});

export default router;
