# DID:web Key Generator

Generate JWK (JSON Web Key) keys and DID:web documents for Self-Sovereign Identity (SSI) applications.

## Installation

```bash
npm install
```

## Usage

Generate a key with a specific algorithm:

```bash
npm run key <algorithm> [domain]
```

### Arguments

- **algorithm** (required): The cryptographic algorithm to use
- **domain** (optional): The domain name for your DID identifier
  - If provided as argument, it takes priority
  - If omitted, uses the system's hostname
  - Falls back to `example.com` if hostname is unavailable

### Supported Algorithms

- **ES256** - ECDSA with SHA-256 (P-256 curve)
- **ES256K** - ECDSA with SHA-256 (secp256k1 curve)
- **ES384** - ECDSA with SHA-384 (P-384 curve)
- **ES512** - ECDSA with SHA-512 (P-521 curve)
- **EdDSA** - Ed25519 signature scheme
- **RS256** - RSA with SHA-256 (2048-bit key)
- **RS384** - RSA with SHA-384 (2048-bit key)
- **RS512** - RSA with SHA-512 (2048-bit key)

### Examples

```bash
# Generate ES256 key with system hostname (auto-detected)
npm run key ES256

# Generate EdDSA key with custom domain
npm run key EdDSA mycompany.com

# Generate ES256K key with explicit domain
npm run key ES256K identity.example.org

# Override system hostname with explicit domain
npm run key ES256 api.company.com
```

## Output

Generated files are saved to the `output/` directory:

- `key_<timestamp>.json` - The private JWK
- `did.json` - The DID:web document with your configured domain
- `did_<algorithm>.txt` - Human-readable summary

## DID:web Document

The generated `did.json` includes:

- **id**: The DID identifier
- **@context**: W3C DID and Verification Method contexts
- **verificationMethod**: Public key information for cryptographic verification
- **authentication**: Key used for authentication
- **assertionMethod**: Key used for credential assertions
- **capabilityInvocation**: Key used for invoking capabilities
- **capabilityDelegation**: Key used for delegating capabilities

## Project Structure

```
.
├── scripts/
│   ├── generate-key.js      # Main key generation script
│   ├── did-config.js        # DID document configuration
│   └── test.js              # Test suite
├── output/                  # Generated keys and DID documents (git-ignored)
├── package.json
└── README.md
```

## License

MIT
