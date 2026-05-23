/**
 * Configuration for DID:web document generation
 * Following W3C DID specification and DID Method specification for did:web
 */

/**
 * Supported algorithms and their key generation parameters
 */
export const ALGORITHM_CONFIG = {
  ES256: {
    alg: 'ES256',
    crv: 'P-256',
    description: 'ECDSA with SHA-256 (P-256 curve)',
    keyType: 'EC',
  },
  ES256K: {
    alg: 'ES256K',
    crv: 'secp256k1',
    description: 'ECDSA with SHA-256 (secp256k1 curve)',
    keyType: 'EC',
  },
  ES384: {
    alg: 'ES384',
    crv: 'P-384',
    description: 'ECDSA with SHA-384 (P-384 curve)',
    keyType: 'EC',
  },
  ES512: {
    alg: 'ES512',
    crv: 'P-521',
    description: 'ECDSA with SHA-512 (P-521 curve)',
    keyType: 'EC',
  },
  EdDSA: {
    alg: 'EdDSA',
    crv: 'Ed25519',
    description: 'Ed25519 signature scheme',
    keyType: 'OKP',
  },
  RS256: {
    alg: 'RS256',
    description: 'RSA with SHA-256 (2048-bit)',
    keyType: 'RSA',
    modulusLength: 2048,
  },
  RS384: {
    alg: 'RS384',
    description: 'RSA with SHA-384 (2048-bit)',
    keyType: 'RSA',
    modulusLength: 2048,
  },
  RS512: {
    alg: 'RS512',
    description: 'RSA with SHA-512 (2048-bit)',
    keyType: 'RSA',
    modulusLength: 2048,
  },
};

/**
 * Generate DID:web document structure
 * @param {string} did - The DID identifier (e.g., did:web:example.com)
 * @param {Object} publicKey - The public JWK
 * @param {string} keyId - The key identifier
 * @returns {Object} The complete DID document
 */
export function generateDidDocument(did, publicKey, keyId) {
  const verificationMethodId = `${did}#${keyId}`;
  // Extract domain from DID (e.g., "example.com" from "did:web:example.com")
  const domain = did.replace('did:web:', '');
  const domainUrl = `https://${domain}`;

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/jws-2020/v1',
    ],
    id: did,
    verificationMethod: [
      {
        id: verificationMethodId,
        type: 'JsonWebKey2020',
        controller: did,
        publicKeyJwk: publicKey,
      },
    ],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    capabilityInvocation: [verificationMethodId],
    capabilityDelegation: [verificationMethodId],
    service: [
      {
        id: `${did}#domain`,
        type: 'LinkedDomains',
        serviceEndpoint: [domainUrl],
      },
    ],
  };
}

/**
 * Generate human-readable summary of the generated key
 * @param {string} algorithm - The algorithm used
 * @param {string} keyId - The key identifier
 * @param {Object} publicKey - The public JWK
 * @returns {string} The summary text
 */
export function generateSummary(algorithm, keyId, publicKey) {
  const config = ALGORITHM_CONFIG[algorithm];
  const timestamp = new Date().toISOString();

  return `DID:web Key Generation Summary
==================================

Algorithm: ${algorithm}
Description: ${config.description}
Generated: ${timestamp}
Key ID: ${keyId}

Public Key (JWK):
${JSON.stringify(publicKey, null, 2)}

Usage:
- Store the private key securely (from key_<timestamp>.json)
- Use the public key in did.json for DID resolution
- Host did.json at: https://yourdomain.com/.well-known/did.json

DID Format: did:web:yourdomain.com

Next Steps:
1. Customize the DID identifier in did.json
2. Host the did.json file at your domain's .well-known endpoint
3. Use the private key for signing operations
4. Keep the private key secret and secure
`;
}
