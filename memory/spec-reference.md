# OID4VP (OpenID for Verifiable Presentations 1.0) — Complete Spec Reference

Source: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html (Final, July 2025)

---

## Overview

OID4VP is a protocol on top of OAuth 2.0 for requesting and presenting W3C Verifiable Credentials, ISO mdocs, SD-JWT VCs, etc. It introduces:

- **DCQL** — Digital Credentials Query Language for expressing credential requirements
- **`vp_token`** — new response type for returning presentations
- **`direct_post`** — new response mode for cross-device / large responses
- **Client Identifier Prefix** — mechanism to identify and verify Verifiers via `client_id` prefix

---

## 1. Two Flows

### 1.1 Same-Device Flow

Wallet and Verifier on the same device. Simple redirects.

```
End-User → Verifier → (1) Auth Req w/ DCQL → Wallet
                     → (2) Auth Response w/ vp_token → Verifier
```

Response Mode defaults to `fragment`.

### 1.2 Cross-Device Flow (OUR USE CASE)

Wallet and Verifier on different devices. QR code + `direct_post`.

```
End-User     Verifier (device A)                            Wallet (device B)
   |               |                                              |
   |  Interacts    |                                              |
   |──────────────>|                                              |
   |               |  (1) Auth Request (QR: client_id + request_uri)
   |               |─────────────────────────────────────────────>|
   |               |                                              |
   |               |  (2) GET request_uri → fetch Request Object  |
   |               |<─────────────────────────────────────────────|
   |               |                                              |
   |               |  (2.5) Respond with Request Object (DCQL)    |
   |               |─────────────────────────────────────────────>|
   |               |                                              |
   |               |  End-User Auth / Consent                     |
   |               |                                              |
   |               |  (3) HTTP POST to response_uri               |
   |               |      (vp_token with Presentation(s))         |
   |               |<─────────────────────────────────────────────|
```

**Step details:**
1. Verifier renders QR with minimal params: `client_id` + `request_uri`
2. Wallet scans QR, GETs the `request_uri` to retrieve the signed Request Object (JWT)
2.5 Request Object contains full Authorization Request: DCQL query, `response_type=vp_token`, `response_mode=direct_post`, `nonce`, `state`, `response_uri`
3. Wallet presents credentials via HTTP POST to `response_uri` with `vp_token` in body

---

## 2. Authorization Request

### 2.1 Core Parameters

| Parameter | Status | Description |
|---|---|---|
| `response_type` | REQUIRED | `vp_token` (pure OID4VP) or `vp_token id_token` (combined w/ SIOPv2) |
| `client_id` | REQUIRED | With prefix (e.g. `redirect_uri:https://...`, `did:web:...`, `verifier_attestation:...`) |
| `response_mode` | REQUIRED | `direct_post` for cross-device |
| `response_uri` | REQUIRED (w/ direct_post) | URL that receives the POST with vp_token |
| `dcql_query` | REQUIRED (mutual exclusive with scope) | DCQL JSON object |
| `nonce` | REQUIRED | Fresh cryptographically random value, bound to session |
| `state` | OPTIONAL | OAuth state, used to correlate request ↔ response |
| `request_uri` | OPTIONAL (for JAR) | URL where the signed Request Object JWT is hosted |
| `client_metadata` | OPTIONAL | Verifier metadata: `vp_formats_supported`, `jwks` |

### 2.2 Request Object (JAR)

The full Authorization Request is packaged as a **signed JWT** (Request Object) per RFC9101.

JOSE Header:
```json
{
  "alg": "ES256",
  "typ": "oauth-authz-req+jwt",
  "kid": "did:web:identitylab.id#kNEWdFSyvEfr91s1AI3r99C0mqGn6XcA5XDxUwHJ2P0"
}
```

Payload:
```json
{
  "client_id": "decentralized_identifier:did:web:identitylab.id",
  "response_uri": "https://demo.identitylab.id/auth/callback",
  "response_type": "vp_token",
  "response_mode": "direct_post",
  "client_metadata": {
    "vp_formats_supported": {
      "jwt_vc_json": {
        "alg_values": ["ES256"]
      }
    }
  },
  "dcql_query": { ... },
  "nonce": "n-0S6_WzA2Mj",
  "state": "eyJhb...6-sVA"
}
```

### 2.3 QR Code / Wallet Invocation

The QR code encodes a minimal URI. Two options:

**Option A — Static openid4vp:// scheme:**
```
openid4vp://?
  client_id=decentralized_identifier%3Adid%3Aweb%3Aidentitylab.id
  &request_uri=https%3A%2F%2Fdemo.identitylab.id%2Fapi%2Fauth%2Frequest%2Fabc123
  &response_mode=direct_post
```

**Option B — HTTPS wallet endpoint (if known):**
```
https://wallet.example.com/authorize?
  client_id=decentralized_identifier%3Adid%3Aweb%3Aidentitylab.id
  &request_uri=https%3A%2F%2Fdemo.identitylab.id%2Fapi%2Fauth%2Frequest%2Fabc123
```

The QR MUST be compact — only `client_id` + `request_uri` (the signed Request Object lives at the `request_uri`).

### 2.4 Client Identifier Prefixes

The `client_id` carries a prefix telling the Wallet how to interpret it:

| Prefix | Description | Auth Required |
|---|---|---|
| `redirect_uri:<url>` | Client ID is the redirect URI itself | No (unsigned OK) |
| `did:<did>` | Client identified by DID | Yes (sign with DID key) |
| `verifier_attestation:<id>` | Client has a verifier attestation JWT | Yes |
| `pre-registered` | Default: known to Wallet ahead of time | Depends |
| `x509_san_dns:<host>` | X.509 SAN DNS | Yes |

---

## 3. DCQL (Digital Credentials Query Language)

### 3.1 Top-Level

```json
{
  "credentials": [ ... ],        // REQUIRED - array of Credential Queries
  "credential_sets": [ ... ]     // OPTIONAL - OR/optional logic
}
```

### 3.2 Credential Query

| Field | Status | Description |
|---|---|---|
| `id` | REQUIRED | Unique alphanumeric ID (`[a-zA-Z0-9_-]+`) |
| `format` | REQUIRED | `jwt_vc`, `dc+sd-jwt`, `mso_mdoc`, `jwt_vp` |
| `meta` | REQUIRED | Format-specific constraints |
| `claims` | OPTIONAL | Array of Claim Queries |
| `claim_sets` | OPTIONAL | Selective disclosure alternatives |
| `trusted_authorities` | OPTIONAL | Trust framework constraints |
| `require_cryptographic_holder_binding` | OPTIONAL | Default: `true` |
| `multiple` | OPTIONAL | Allow multiple VCs? Default: `false` |

**Format-specific `meta`:**
- `jwt_vc` / `jwt_vp`: `{ "type_values": ["VerifiableCredential", "AcademicCredential"] }`
- `dc+sd-jwt`: `{ "vct_values": ["https://..."] }`
- `mso_mdoc`: `{ "doctype_value": "org.iso.18013.5.1.mDL" }`

### 3.3 Claims Query

```json
{
  "id": "claim_name",            // Required if claim_sets used
  "path": ["credentialSubject", "name"],  // JSON path pointer
  "values": ["expected_value"]   // OPTIONAL - value matching
}
```

### 3.4 credential_sets (OR / Optional)

```json
{
  "credential_sets": [
    { "options": [ ["pid"], ["other_pid"] ], "required": true },
    { "options": [ ["nice_to_have"] ], "required": false }
  ]
}
```

---

## 4. Response

### 4.1 VP Token

The `vp_token` is a JSON object keyed by credential `id` from the DCQL query:

```json
{
  "academic_credential": ["eyJhbGci...QMA"]
}
```

Each value is an array of one or more presentations (as JWT strings or objects).

### 4.2 direct_post Response

The Wallet sends an HTTP POST to `response_uri`:

```
POST /auth/callback HTTP/1.1
Host: demo.identitylab.id
Content-Type: application/x-www-form-urlencoded

vp_token=...&state=eyJhb...6-sVA
```

Verifier responds with HTTP 200 + JSON:
```json
{
  "redirect_uri": "https://demo.identitylab.id/dashboard#response_code=abc123"
}
```

The `redirect_uri` is OPTIONAL — if present, Wallet redirects the user agent there.

---

## 5. Wallet Invocation (Section 9)

The Verifier invokes the Wallet using:

1. **Custom URL scheme** — `openid4vp://` as the `authorization_endpoint`
2. **Universal Link / App Link** — HTTPS URL as `authorization_endpoint`
3. **QR Code** — for cross-device, encode the invocation URI as QR

The `openid4vp://` scheme is registered in IANA. Static configuration for it:

```json
{
  "authorization_endpoint": "openid4vp:",
  "response_types_supported": ["vp_token"],
  "vp_formats_supported": {
    "dc+sd-jwt": {
      "sd-jwt_alg_values": ["ES256"],
      "kb-jwt_alg_values": ["ES256"]
    },
    "mso_mdoc": {}
  },
  "request_object_signing_alg_values_supported": ["ES256"]
}
```

---

## 6. Comparison: Current Implementation vs OID4VP Spec

| Aspect | Current (wrong) | OID4VP Correct |
|---|---|---|
| URI scheme | `siopv2://` | `openid4vp://` or HTTPS wallet endpoint |
| Response type | `vp_token id_token` | `vp_token` (pure OID4VP) |
| `id_token_type` | `subject_signed` | Not present (SIOP-only) |
| `scope` | `openid` | Not needed (SIOP-only) |
| Client ID | `did:web:identitylab.id` (bare) | `decentralized_identifier:did:web:identitylab.id` |
| QR content | Full `siopv2://` URI with `request_uri` param | Minimal: `client_id` + `request_uri` |
| Callback expects | `vp_token` + `id_token` + `state` | Only `vp_token` + `state` |
| Endpoint name | `siop-request` | `auth/request` or `authorize` |
| Frontend labels | "SIOP v2" | "OpenID4VP" |

---

## 7. Correct Cross-Device Flow for This Project

```
[Verifier Server]                          [Wallet App]
       |                                        |
       |── POST /api/auth/openid4vp-request ──→  (generate session, nonce, sign Request Object JWT)
       |←── { sessionId, openid4vpUri } ──────|
       |                                        |
       |  (render QR with openid4vp:// URI)     |
       |                                        |
       |                              User scans QR with Wallet
       |                                        |
       |←── GET /api/auth/request/:sessionId ──|  (fetch signed Request Object)
       |── Request Object JWT (typ: oauth-authz-req+jwt) ──→|
       |                                        |
       |                     Wallet processes DCQL, user consents
       |                                        |
       |←── POST /auth/callback ──────────────|
       |    (vp_token + state)                  |
       |                                        |
       |  Return { redirect_uri } or { success, sessionToken }
       |                                        |
```

**Request Object payload:**
```json
{
  "client_id": "decentralized_identifier:did:web:identitylab.id",
  "response_uri": "https://demo.identitylab.id/auth/callback",
  "response_type": "vp_token",
  "response_mode": "direct_post",
  "nonce": "uuid-v4",
  "state": "uuid-v4",
  "dcql_query": {
    "credentials": [{
      "id": "academic_credential",
      "format": "jwt_vc",
      "meta": {
        "type_values": ["VerifiableCredential", "AcademicCredential"]
      },
      "claims": [
        { "path": ["credentialSubject", "name"] },
        { "path": ["credentialSubject", "role"] },
        { "path": ["credentialSubject", "id_number"] },
        { "path": ["credentialSubject", "faculty"] },
        { "path": ["issuer"], "values": ["did:web:identitylab.id"] }
      ]
    }]
  }
}
```

**QR URI:**
```
openid4vp://?
  client_id=decentralized_identifier%3Adid%3Aweb%3Aidentitylab.id
  &request_uri=https%3A%2F%2Fdemo.identitylab.id%2Fapi%2Fauth%2Frequest%2F<sessionId>
  &response_mode=direct_post
```

**Callback POST body:**
```
vp_token={"academic_credential":["eyJhbGci..."]}&state=<state>
```

**Callback response (on success):**
```json
{
  "redirect_uri": "https://demo.identitylab.id/dashboard#response_code=<code>"
}
```
