#!/usr/bin/env node

import { generateKeyPair, exportSPKI, exportPKCS8 } from 'jose';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { hostname } from 'os';
import { ALGORITHM_CONFIG, generateDidDocument, generateSummary } from './did-config.js';

const __dirname = fileURLToPath(import.meta.url).split('/').slice(0, -1).join('/');
const OUTPUT_DIR = join(__dirname, '..', 'output');

/**
 * Validate the provided algorithm
 */
function isValidAlgorithm(algorithm) {
  return Object.keys(ALGORITHM_CONFIG).includes(algorithm);
}

/**
 * Convert JWK with private components from exportPKCS8
 */
async function extractJwkFromKey(algorithm, publicKeyBuffer, privateKeyBuffer) {
  const config = ALGORITHM_CONFIG[algorithm];

  // Parse PKCS8 to extract components
  // For this, we'll use a different approach with crypto
  const crypto = (await import('crypto')).default || (await import('crypto'));

  if (config.keyType === 'EC') {
    // For EC keys, we need to parse the PKCS8 structure
    // Using a simpler approach: regenerate the key as JWK using node's crypto
    const keyObject = crypto.createPrivateKey(privateKeyBuffer);
    const jwk = keyObject.export({ format: 'jwk' });
    return {
      private: {
        kty: 'EC',
        crv: config.crv,
        alg: config.alg,
        x: jwk.x,
        y: jwk.y,
        d: jwk.d,
        use: 'sig',
        key_ops: ['sign'],
      },
      public: {
        kty: 'EC',
        crv: config.crv,
        alg: config.alg,
        x: jwk.x,
        y: jwk.y,
        use: 'sig',
        key_ops: ['verify'],
      },
    };
  } else if (config.keyType === 'OKP') {
    const keyObject = crypto.createPrivateKey(privateKeyBuffer);
    const jwk = keyObject.export({ format: 'jwk' });
    return {
      private: {
        kty: 'OKP',
        crv: config.crv,
        alg: config.alg,
        x: jwk.x,
        d: jwk.d,
        use: 'sig',
        key_ops: ['sign'],
      },
      public: {
        kty: 'OKP',
        crv: config.crv,
        alg: config.alg,
        x: jwk.x,
        use: 'sig',
        key_ops: ['verify'],
      },
    };
  } else if (config.keyType === 'RSA') {
    const keyObject = crypto.createPrivateKey(privateKeyBuffer);
    const jwk = keyObject.export({ format: 'jwk' });
    return {
      private: {
        kty: 'RSA',
        alg: config.alg,
        n: jwk.n,
        e: jwk.e,
        d: jwk.d,
        p: jwk.p,
        q: jwk.q,
        dp: jwk.dp,
        dq: jwk.dq,
        qi: jwk.qi,
        use: 'sig',
        key_ops: ['sign'],
      },
      public: {
        kty: 'RSA',
        alg: config.alg,
        n: jwk.n,
        e: jwk.e,
        use: 'sig',
        key_ops: ['verify'],
      },
    };
  }
}

/**
 * Resolve domain from argument, server hostname, or default
 */
function resolveDomain(domainArg) {
  if (domainArg && domainArg.trim()) {
    return domainArg.trim();
  }

  const serverHostname = hostname();
  if (serverHostname && serverHostname.trim()) {
    return serverHostname.trim();
  }

  return 'example.com';
}

/**
 * Main entry point
 */
async function main() {
  const algorithm = process.argv[2];
  const domainArg = process.argv[3];

  if (!algorithm) {
    console.error('Usage: npm run key <algorithm> [domain]');
    console.error('\nSupported algorithms:');
    Object.entries(ALGORITHM_CONFIG).forEach(([alg, config]) => {
      console.error(`  ${alg.padEnd(10)} - ${config.description}`);
    });
    console.error('\nOptions:');
    console.error('  domain     - Optional. Custom domain for DID (e.g., example.com)');
    console.error('             - If omitted, uses system hostname');
    console.error('             - Falls back to "example.com" if hostname is unavailable');
    process.exit(1);
  }

  if (!isValidAlgorithm(algorithm)) {
    console.error(`Error: Algorithm "${algorithm}" is not supported.`);
    console.error('\nSupported algorithms:');
    Object.entries(ALGORITHM_CONFIG).forEach(([alg, config]) => {
      console.error(`  ${alg.padEnd(10)} - ${config.description}`);
    });
    process.exit(1);
  }

  try {
    const domain = resolveDomain(domainArg);
    console.log(`🔐 Generating ${algorithm} key pair...`);
    console.log(`🌐 Domain: ${domain}`);

    // Generate key pair
    const { publicKey, privateKey } = await generateKeyPair(algorithm);

    // Export to PEM/PKCS8 format
    const publicPem = await exportSPKI(publicKey);
    const privatePem = await exportPKCS8(privateKey);

    // Extract JWK components
    const timestamp = Date.now();
    const keyId = `key-${timestamp}`;
    const did = `did:web:${domain}`;

    const jwks = await extractJwkFromKey(algorithm, publicPem, privatePem);

    // Add key ID to JWKs
    jwks.private.kid = keyId;
    jwks.public.kid = keyId;

    // Generate DID document
    const didDocument = generateDidDocument(did, jwks.public, keyId);

    // Write files
    const privateKeyPath = join(OUTPUT_DIR, `key_${timestamp}.json`);
    const didPath = join(OUTPUT_DIR, 'did.json');
    const summaryPath = join(OUTPUT_DIR, `did_${algorithm}.txt`);

    writeFileSync(privateKeyPath, JSON.stringify(jwks.private, null, 2));
    writeFileSync(didPath, JSON.stringify(didDocument, null, 2));

    const summary = generateSummary(algorithm, keyId, jwks.public);
    writeFileSync(summaryPath, summary);

    console.log(`\n✅ Key generation complete!\n`);
    console.log(`📁 Output files saved to: ${OUTPUT_DIR}/`);
    console.log(`  - Private key: key_${timestamp}.json`);
    console.log(`  - DID document: did.json`);
    console.log(`  - Summary: did_${algorithm}.txt`);
    console.log(`\n⚠️  Keep the private key file secure!`);
    console.log(`📝 DID identifier: ${did}`);
    console.log(`🌐 Host did.json at: https://${domain}/.well-known/did.json\n`);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
