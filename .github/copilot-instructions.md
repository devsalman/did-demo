# Copilot Instructions for DID:web Key Generator

## Project Overview

This is a Node.js utility for generating JWK (JSON Web Key) cryptographic key pairs and corresponding DID:web (Decentralized Identifier) documents for Self-Sovereign Identity (SSI) applications. The script supports multiple cryptographic algorithms and generates standards-compliant W3C DID documents.

## Build, Test & Commands

### Install Dependencies
```bash
npm install
```

### Generate Keys
```bash
npm run key <algorithm>
```

Supported algorithms:
- `ES256` - ECDSA with SHA-256 (P-256, most common)
- `ES256K` - ECDSA with SHA-256 (secp256k1, Bitcoin-compatible)
- `ES384` - ECDSA with SHA-384 (P-384)
- `ES512` - ECDSA with SHA-512 (P-521)
- `EdDSA` - Ed25519 (modern, faster)
- `RS256`, `RS384`, `RS512` - RSA variants (2048-bit)

Examples:
```bash
npm run key ES256
npm run key EdDSA
npm run key ES256K
```

### Run Tests
```bash
npm test
```

### Lint Code
```bash
npm run lint
```

## Output Structure

All generated files are placed in `/output/` (git-ignored):

- `key_<timestamp>.json` - Private JWK with all key material (d, x, y components)
- `did.json` - W3C-compliant DID document with public key information
- `did_<algorithm>.txt` - Human-readable summary

## Architecture & Key Concepts

### DID:web Standard
- **Format**: `did:web:yourdomain.com` - Domain-based DID identifier
- **Resolution**: The DID document must be hosted at `https://yourdomain.com/.well-known/did.json`
- **W3C Spec**: Follows [W3C DID Core specification](https://www.w3.org/TR/did-core/)

### Key Pair Generation Process
1. Use `jose` library (Node.js crypto-agnostic) to generate algorithm-specific key pairs
2. Export keys in PKCS8/SPKI format
3. Convert to JWK (JSON Web Key) format using Node's crypto module
4. Separate public and private components for different files

### DID Document Structure
The generated `did.json` includes:

```json
{
  "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
  "id": "did:web:example.com",
  "verificationMethod": [{
    "id": "did:web:example.com#key-<timestamp>",
    "type": "JsonWebKey2020",
    "controller": "did:web:example.com",
    "publicKeyJwk": { /* public key material */ }
  }],
  "authentication": ["did:web:example.com#key-<timestamp>"],
  "assertionMethod": ["did:web:example.com#key-<timestamp>"],
  "capabilityInvocation": ["did:web:example.com#key-<timestamp>"],
  "capabilityDelegation": ["did:web:example.com#key-<timestamp>"]
}
```

Each verification method relationship (authentication, assertionMethod, etc.) enables different use cases in SSI protocols.

## Code Organization

### `scripts/generate-key.js`
Main entry point. Handles:
- Algorithm validation
- Key pair generation via `jose`
- JWK extraction and formatting
- File I/O to output directory

### `scripts/did-config.js`
Configuration and utilities:
- `ALGORITHM_CONFIG` - Algorithm definitions with curve/parameter specs
- `generateDidDocument()` - Creates W3C-compliant DID structure
- `generateSummary()` - Human-readable output

### `scripts/test.js`
Validates algorithm configuration on startup

## Important Conventions

### Key Security
- Private keys (`key_*.json`) are NEVER committed to git (.gitignore covers `/output/`)
- The `d` parameter in JWK is the private key component - keep confidential
- Users should host only `did.json` publicly, not the private key file

### Customization Required
Generated DID documents use placeholder `did:web:example.com`. Update before deployment:
1. Replace `example.com` with actual domain
2. Ensure `did.json` is accessible at `https://yourdomain.com/.well-known/did.json`

### Algorithm Selection
- **Default (ES256)**: Most compatible with Web standards and JWT implementations
- **EdDSA**: Faster, modern, recommended for performance-sensitive apps
- **ES256K**: Only if Bitcoin/blockchain integration needed
- **RS256/384/512**: Legacy support, generally not recommended (prefer EC)

### JWK Format Details
- `kty` (Key Type): `EC` (Elliptic Curve), `OKP` (Octet string key pairs), `RSA`
- `crv` (Curve): The specific curve (P-256, P-384, P-521, secp256k1, Ed25519)
- `alg` (Algorithm): The JWT/JWS algorithm identifier
- `key_ops`: Set to `["sign"]` for private keys, `["verify"]` for public keys
- `kid` (Key ID): Matches the verificationMethod ID in DID document

## Dependencies

- **jose** (5.0.0+): Cryptographic key generation and format handling
- **Node.js built-in crypto**: Key extraction and JWK conversion
- **eslint**: Code quality (dev dependency)

The `jose` library provides a unified interface across Node's crypto backends, ensuring algorithm compatibility.

## Common Tasks

### Generate a new key for production deployment
```bash
npm run key ES256
# Edit output/did.json to replace example.com with your domain
# Host output/did.json at your domain's /.well-known/ endpoint
# Store output/key_*.json securely (HSM, secure vault, or encrypted storage)
```

### Verify generated key format
```bash
cat output/key_<timestamp>.json | jq '.kty, .crv, .alg'
```

### Debug key generation issues
```bash
npm run key <algorithm> 2>&1 | tee debug.log
```

## Performance Notes

Key generation time varies by algorithm:
- **EC algorithms (ES256, ES384, ES512, ES256K)**: ~1-50ms
- **EdDSA**: ~1-10ms (fastest)
- **RSA algorithms**: ~500-2000ms (slower, key size dependent)

## Testing New Algorithms

When adding support for new algorithms:
1. Add entry to `ALGORITHM_CONFIG` in `scripts/did-config.js`
2. Ensure `generateKeyPair()` from `jose` supports the algorithm name
3. Add JWK extraction logic in `extractJwkFromKey()` if needed
4. Run `npm test` to validate configuration
5. Test: `npm run key <NEW_ALGORITHM>`
