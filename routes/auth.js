import express from 'express';
import * as jose from 'jose';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Resolver } from 'did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';
import { getResolver as getKeyResolver } from 'key-did-resolver';
import bs58 from 'bs58';

const router = express.Router();

const ISSUER_DID = 'did:web:identitylab.id';
const CALLBACK_URL = 'https://demo.identitylab.id/auth/callback';
const BASE_URL = 'https://demo.identitylab.id';

function loadKeys() {
  const didPath = process.env.PUBLIC_KEY_FILE || path.join(os.homedir(), '.identitylab.id', 'key', 'did.json');
  const jwkPath = process.env.PRIVATE_KEY_FILE || path.join(os.homedir(), '.identitylab.id', 'key', 'key.json');

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
  console.error(`Warning: ${error.message}`);
}

let didResolver;

try {
  const { getResolver: getEthrResolver } = await import('ethr-did-resolver');
  didResolver = new Resolver({
    ...getWebResolver(),
    ...getKeyResolver(),
    ...getEthrResolver({
      networks: [{ name: 'mainnet', rpcUrl: 'https://eth.drpc.org' }],
    }),
  });
  console.log('DID resolver initialized (web + key + ethr)');
} catch (e) {
  didResolver = new Resolver({
    ...getWebResolver(),
    ...getKeyResolver(),
  });
  console.log('DID resolver initialized (web + key, ethr unavailable:', e.message + ')');
}

const sessions = new Map();
const requestObjects = new Map();

// Derive the kid from the DID document's first verification method
function getKid() {
  if (!keys) return null;
  const vm = keys.did.verificationMethod?.[0];
  return vm?.id || null;
}

// Serve the signed Request Object JWT (request_uri method)
router.get('/api/auth/request/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const requestJwt = requestObjects.get(sessionId);

  if (!requestJwt) {
    return res.status(404).json({ error: 'Request not found' });
  }

  res.setHeader('Content-Type', 'application/oauth-authz-req+jwt');
  res.send(requestJwt);
});

// Initiate OID4VP authorization request
router.post('/api/auth/openid4vp-request', async (req, res) => {
  try {
    if (!keys) {
      return res.status(500).json({ error: 'Key files not configured' });
    }

    const sessionId = uuidv4();
    const nonce = uuidv4();
    const state = uuidv4();

    sessions.set(state, {
      nonce,
      state,
      sessionId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const kid = getKid();

    const authRequest = {
      client_id: `decentralized_identifier:${ISSUER_DID}`,
      response_uri: CALLBACK_URL,
      response_type: 'vp_token',
      response_mode: 'direct_post',
      nonce,
      state,
      client_metadata: {
        vp_formats_supported: {
          jwt_vc_json: {
            alg_values: [keys.jwk.alg],
          },
        },
      },
      dcql_query: {
        credentials: [
          {
            id: 'academic_credential',
            format: 'jwt_vc',
            meta: {
              type_values: ['VerifiableCredential', 'AcademicCredential'],
            },
            claims: [
              { path: ['credentialSubject', 'name'] },
              { path: ['credentialSubject', 'role'] },
              { path: ['credentialSubject', 'id_number'] },
              { path: ['credentialSubject', 'faculty'] },
              { path: ['issuer'], values: [ISSUER_DID] },
            ],
          },
        ],
      },
    };

    const privateKey = await jose.importJWK(keys.jwk);
    const requestJwt = await new jose.SignJWT(authRequest)
      .setProtectedHeader({
        alg: keys.jwk.alg,
        typ: 'oauth-authz-req+jwt',
        kid,
      })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    requestObjects.set(sessionId, requestJwt);

    const requestUri = `${BASE_URL}/api/auth/request/${sessionId}`;
    const clientIdEncoded = encodeURIComponent(`decentralized_identifier:${ISSUER_DID}`);
    const requestUriEncoded = encodeURIComponent(requestUri);
    const openid4vpUri = `openid4vp://?client_id=${clientIdEncoded}&request_uri=${requestUriEncoded}&response_mode=direct_post`;

    res.json({
      sessionId,
      openid4vpUri,
      requestUri,
      requestJwt,
    });
  } catch (error) {
    console.error('OID4VP Request Error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function verifyCredentialJwt(jwt) {
  const protectedHeader = jose.decodeProtectedHeader(jwt);
  const payload = jose.decodeJwt(jwt);
  const issuer = payload.iss || payload.issuer;
  const kid = protectedHeader.kid;

  let resolution;
  try {
    resolution = await didResolver.resolve(issuer);
  } catch (resolveError) {
    throw new Error(`DID resolution failed for ${issuer}: ${resolveError.message}`);
  }

  const didDoc = resolution.didDocument;

  if (!didDoc || !didDoc.verificationMethod) {
    throw new Error(`No verification methods in DID document for ${issuer}`);
  }

  let vm;
  if (kid) {
    vm = didDoc.verificationMethod.find(
      m => m.id === kid || m.id.endsWith('#' + kid)
    );
  }
  if (!vm) {
    vm = didDoc.verificationMethod[0];
  }

  let publicKey;
  if (vm.publicKeyJwk) {
    publicKey = await jose.importJWK(vm.publicKeyJwk);
  } else if (vm.publicKeyBase58) {
    const rawKey = bs58.decode(vm.publicKeyBase58);
    const jwk = {
      kty: 'OKP',
      crv: 'Ed25519',
      x: Buffer.from(rawKey).toString('base64url'),
    };
    publicKey = await jose.importJWK(jwk);
  } else {
    throw new Error(`Unsupported key format for ${vm.id}`);
  }

  await jose.jwtVerify(jwt, publicKey);
  return payload;
}

async function handleCallback(vp_token, state, res) {
  try {
    if (!vp_token || !state) {
      return res.status(400).json({ error: 'Missing vp_token or state' });
    }

    const session = sessions.get(state);
    if (!session || session.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    let credential = null;
    let credentialSubject = null;

    let vpData;
    if (typeof vp_token === 'string') {
      try {
        vpData = JSON.parse(vp_token);
      } catch {
        vpData = { academic_credential: [vp_token] };
      }
    } else {
      vpData = vp_token;
    }

    const credentialIds = Object.keys(vpData);
    if (credentialIds.length > 0) {
      const presentations = vpData[credentialIds[0]];
      if (Array.isArray(presentations) && presentations.length > 0) {
        const credJwt = presentations[0];
        if (typeof credJwt === 'string') {
          const credDecoded = await verifyCredentialJwt(credJwt);
          credential = credDecoded;
          credentialSubject = credDecoded?.credentialSubject || null;
        } else if (typeof credJwt === 'object') {
          credential = credJwt;
          credentialSubject = credJwt?.credentialSubject || null;
        }
      }
    }

    if (credential && credential.nonce && credential.nonce !== session.nonce) {
      return res.status(401).json({ error: 'Nonce mismatch' });
    }

    const userSession = {
      id: uuidv4(),
      authenticated: true,
      did: credentialSubject?.id,
      name: credentialSubject?.name,
      role: credentialSubject?.role,
      idNumber: credentialSubject?.id_number,
      faculty: credentialSubject?.faculty,
      issuer: credential?.issuer,
      issuedAt: credential?.issuanceDate,
      credential,
      vpToken: vp_token,
      authenticatedAt: new Date().toISOString(),
    };

    sessions.set(userSession.id, userSession);
    sessions.set(session.sessionId, userSession);
    sessions.delete(state);

    res.json({
      success: true,
      sessionToken: userSession.id,
      user: {
        did: userSession.did,
        name: userSession.name,
        role: userSession.role,
        idNumber: userSession.idNumber,
        faculty: userSession.faculty,
      },
    });
  } catch (error) {
    console.error('Callback Error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Callback endpoint — receives VP token from wallet
router.post('/auth/callback', (req, res) => {
  handleCallback(req.body.vp_token, req.body.state, res);
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
      role: session.role,
      idNumber: session.idNumber,
      faculty: session.faculty,
      authenticatedAt: session.authenticatedAt,
    },
  });
});

// Serve full credential data
router.get('/api/auth/credential', (req, res) => {
  const sessionToken = req.query.token;

  if (!sessionToken) {
    return res.status(401).json({ error: 'No session token' });
  }

  const session = sessions.get(sessionToken);
  if (!session || !session.authenticated) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  res.json({
    credential: session.credential,
    vpToken: session.vpToken,
    user: {
      did: session.did,
      name: session.name,
      role: session.role,
      idNumber: session.idNumber,
      faculty: session.faculty,
    },
  });
});

export default router;
