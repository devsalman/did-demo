#!/usr/bin/env node

import crypto from 'crypto';
import { generateKeyPair, calculateJwkThumbprint, exportJWK } from 'jose';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { hostname } from 'os';
import { ALGORITHM_CONFIG, generateDidDocument, generateSummary } from './did-config.js';

const OUTPUT_DIR = './out';
mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Validate the provided algorithm
 */
function isValidAlgorithm(algorithm) {
  return Object.keys(ALGORITHM_CONFIG).includes(algorithm);
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
    const { publicKey, privateKey } = await generateKeyPair(algorithm, {extractable: true});
    const publicKeyId = await calculateJwkThumbprint(publicKey, 'sha256');
    const privateKeyId = await calculateJwkThumbprint(privateKey, 'sha256');

    // Export to PEM/PKCS8 format
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = publicKeyId;
    publicJwk.alg = algorithm;
    
    const privateJwk = await exportJWK(privateKey);
    privateJwk.kid = privateKeyId;
    privateJwk.alg = algorithm;
    
    const did = `did:web:${domain}`;

    // Generate DID document
    const didDocument = generateDidDocument(did, publicJwk);

    // Write files
    const privateKeyPath = join(OUTPUT_DIR, 'key.json');
    const didPath = join(OUTPUT_DIR, 'did.json');
    const summaryPath = join(OUTPUT_DIR, `did_${algorithm}.txt`);

    writeFileSync(privateKeyPath, JSON.stringify(privateJwk, null, 2));
    writeFileSync(didPath, JSON.stringify(didDocument, null, 2));

    const summary = generateSummary(algorithm, publicKeyId, publicJwk);
    writeFileSync(summaryPath, summary);

    console.log(`\n✅ Key generation complete!\n`);
    console.log(`📁 Output files saved to: ${OUTPUT_DIR}/`);
    console.log(`  - Private key: key.json`);
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
