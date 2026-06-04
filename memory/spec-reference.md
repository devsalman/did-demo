# SIOPv2 + OID4VP Spec Reference

## SIOPv2 Spec
- https://openid.net/specs/openid-connect-self-issued-v2-1_0.html (draft 13)

## OID4VP Spec
- https://openid.net/specs/openid-4-verifiable-presentations-1_0.html (Final, July 2025)

---

# DCQL (Digital Credentials Query Language) — Complete Reference

DCQL (pronounced "dackl") is a JSON-encoded query language for requesting Verifiable Credentials.

## Top-Level Properties

| Property | Req | Description |
|---|---|---|
| `credentials` | REQUIRED | Non-empty array of Credential Queries |
| `credential_sets` | OPTIONAL | Array of Credential Set Queries for OR/optional logic |

---

## 1. Credential Query — `credentials[]` (Section 6.1)

Each entry is an object requesting one type of Credential:

| Property | Req | Description |
|---|---|---|
| `id` | REQUIRED | Unique identifier for this credential query (alphanumeric, `_`, `-`) |
| `format` | REQUIRED | Credential format identifier (e.g., `jwt_vc`, `dc+sd-jwt`, `mso_mdoc`) |
| `multiple` | OPTIONAL | Boolean: allow multiple matching VCs? Default: `false` |
| `meta` | REQUIRED | Format-specific metadata constraints (e.g., `vct_values`, `doctype_value`) |
| `trusted_authorities` | OPTIONAL | Array of trusted issuer/trust framework constraints |
| `require_cryptographic_holder_binding` | OPTIONAL | Boolean. Default: `true` |
| `claims` | OPTIONAL | Array of Claim Queries specifying which claims to request |
| `claim_sets` | OPTIONAL | Array of claim ID combinations for selective disclosure |

### Supported Format Identifiers (Appendix B)

| Format ID | Description |
|---|---|
| `jwt_vc` | W3C Verifiable Credential as JWT |
| `jwt_vp` | W3C Verifiable Presentation as JWT |
| `dc+sd-jwt` | IETF SD-JWT VC |
| `mso_mdoc` | ISO/IEC 18013-5 mdoc |

### Format-specific `meta` Parameters

**For `dc+sd-jwt` (SD-JWT VC):**
```json
"meta": {
  "vct_values": ["https://credentials.example.com/identity_credential"]
}
```

**For `mso_mdoc` (ISO mdoc):**
```json
"meta": {
  "doctype_value": "org.iso.18013.5.1.mDL"
}
```

**For `jwt_vc` (W3C VC as JWT):**
```json
"meta": {}
```

---

## 2. Claims Query — `claims[]` (Section 6.3)

| Property | Req | Description |
|---|---|---|
| `id` | REQUIRED (if `claim_sets` present) | Identifier for referencing in `claim_sets` |
| `path` | REQUIRED | Array path pointer to the claim in the VC |
| `values` | OPTIONAL | Array of expected values for value matching |

### Path Pointer Examples (Section 7.3)

```json
["name"]                        // Top-level claim "name"
["address", "street_address"]   // Nested claim
["degrees", null, "type"]       // All "type" claims in degrees array
["nationalities", 1]            // Second element in array
["credentialSubject", "degree"] // VC data model path
["issuer"]                      // Issuer field
```

### Value Matching

```json
// Exact match
{ "path": ["issuer"], "values": ["did:web:identitylab.id"] }

// Multiple allowed values
{ "path": ["credentialSubject", "status"], "values": ["student", "alumni"] }
```

---

## 3. `claim_sets` — Selective Disclosure Alternatives (Section 6.4.1)

Request one combination. Order expresses preference.

```json
{
  "claims": [
    { "id": "full_dob", "path": ["credentialSubject", "dateOfBirth"] },
    { "id": "over_18", "path": ["credentialSubject", "ageOver18"] },
    { "id": "over_21", "path": ["credentialSubject", "ageOver21"] }
  ],
  "claim_sets": [
    ["over_18"],    // preferred: just "over 18"
    ["over_21"],    // fallback: just "over 21"
    ["full_dob"]    // last resort: full date of birth
  ]
}
```

---

## 4. `trusted_authorities` — Trust Framework Constraints (Section 6.1.1)

| Type | Description | Example |
|---|---|---|
| `aki` | Authority Key Identifier (X.509) | `{"type": "aki", "values": ["s9tIpPmhxdiuNkHMEWNpYim8S8Y"]}` |
| `etsi_tl` | ETSI Trusted List URL | `{"type": "etsi_tl", "values": ["https://lotl.example.com"]}` |
| `openid_federation` | OpenID Federation Trust Anchor | `{"type": "openid_federation", "values": ["https://trustanchor.example.com"]}` |

Usage:
```json
{
  "credentials": [{
    "id": "eu_driver_license",
    "format": "mso_mdoc",
    "meta": { "doctype_value": "org.iso.18013.5.1.mDL" },
    "trusted_authorities": [
      { "type": "etsi_tl", "values": ["https://eu-tl.example.com"] }
    ]
  }]
}
```

---

## 5. `credential_sets` — OR / Optional VC Logic (Section 6.2)

| Property | Req | Description |
|---|---|---|
| `options` | REQUIRED | Array of arrays, each referencing `id`s from `credentials` |
| `required` | OPTIONAL | Boolean. Default: `true` |

### OR — one of several credential types

```json
{
  "credentials": [
    { "id": "pid", "format": "dc+sd-jwt", "meta": { "vct_values": ["..."] }, "claims": [...] },
    { "id": "other_pid", "format": "dc+sd-jwt", "meta": { ... }, "claims": [...] },
    { "id": "pid_reduced_1", ... },
    { "id": "pid_reduced_2", ... }
  ],
  "credential_sets": [
    { "options": [
        ["pid"],
        ["other_pid"],
        ["pid_reduced_1", "pid_reduced_2"]
    ]}
  ]
}
```

### Optional (nice-to-have) credential

```json
{
  "credential_sets": [
    { "required": false, "options": [ ["nice_to_have"] ] }
  ]
}
```

---

## 6. `multiple` — Allow Multiple VCs of Same Type (Section 6.1)

```json
{
  "credentials": [{
    "id": "degrees",
    "format": "jwt_vc",
    "multiple": true,
    "meta": {},
    "claims": [
      { "path": ["credentialSubject", "degree"] }
    ]
  }]
}
```

---

## 7. Combined SIOPv2 + OID4VP (Appendix C)

### Request
```
response_type=vp_token id_token
scope=openid
id_token_type=subject_signed
client_id=x509_san_dns:client.example.org
redirect_uri=https://client.example.org/cb
dcql_query={...}
nonce=n-0S6_WzA2Mj
```

### Self-Issued ID Token response
```json
{
  "iss": "did:example:NzbLsXh8uDCcd6MNwXF4W7noWXFZAfHkxZsRGC9Xs",
  "sub": "did:example:NzbLsXh8uDCcd6MNwXF4W7noWXFZAfHkxZsRGC9Xs",
  "aud": "x509_san_dns:client.example.org",
  "nonce": "n-0S6_WzA2Mj",
  "exp": 1311281970,
  "iat": 1311280970
}
```

---

## 8. Examples

### Basic — single VC with claims (§5.4)

```json
{
  "credentials": [{
    "id": "some_identity_credential",
    "format": "dc+sd-jwt",
    "meta": {
      "vct_values": ["https://credentials.example.com/identity_credential"]
    },
    "claims": [
      {"path": ["last_name"]},
      {"path": ["first_name"]}
    ]
  }]
}
```

### Multiple VCs (Appendix D)

```json
{
  "credentials": [
    {
      "id": "pid",
      "format": "dc+sd-jwt",
      "meta": { "vct_values": ["https://credentials.example.com/identity_credential"] },
      "claims": [
        {"path": ["given_name"]},
        {"path": ["family_name"]},
        {"path": ["address", "street_address"]}
      ]
    },
    {
      "id": "mdl",
      "format": "mso_mdoc",
      "meta": { "doctype_value": "org.iso.7367.1.mVRC" },
      "claims": [
        {"path": ["org.iso.7367.1", "vehicle_holder"]},
        {"path": ["org.iso.18013.5.1", "first_name"]}
      ]
    }
  ]
}
```

### Complex OR + optional (Appendix D)

```json
{
  "credentials": [
    { "id": "pid", "format": "dc+sd-jwt", "meta": { "vct_values": ["..."] }, "claims": [...] },
    { "id": "other_pid", "format": "dc+sd-jwt", "meta": { ... }, "claims": [...] },
    { "id": "pid_reduced_cred_1", ... },
    { "id": "pid_reduced_cred_2", ... },
    { "id": "nice_to_have", ... }
  ],
  "credential_sets": [
    { "options": [ ["pid"], ["other_pid"], ["pid_reduced_cred_1", "pid_reduced_cred_2"] ] },
    { "required": false, "options": [ ["nice_to_have"] ] }
  ]
}
```

### mDL or PhotoID for ID + address (Appendix D)

```json
{
  "credentials": [
    { "id": "mdl-id", "format": "mso_mdoc", "meta": { "doctype_value": "org.iso.18013.5.1.mDL" }, "claims": [...] },
    { "id": "mdl-address", "format": "mso_mdoc", "meta": { "doctype_value": "org.iso.18013.5.1.mDL" }, "claims": [...] },
    { "id": "photo_card-id", "format": "mso_mdoc", "meta": { "doctype_value": "org.iso.23220.photoid.1" }, "claims": [...] },
    { "id": "photo_card-address", "format": "mso_mdoc", "meta": { "doctype_value": "org.iso.23220.photoid.1" }, "claims": [...] }
  ],
  "credential_sets": [
    { "options": [ ["mdl-id"], ["photo_card-id"] ] },
    { "required": false, "options": [ ["mdl-address"], ["photo_card-address"] ] }
  ]
}
```

### Current project implementation

```json
{
  "credentials": [{
    "id": "academic_credential",
    "format": "jwt_vc",
    "claims": [
      { "path": ["credentialSubject", "degree"] },
      { "path": ["issuer"], "values": ["did:web:identitylab.id"] }
    ]
  }]
}
```

---

## 9. Cross-Device SIOPv2 Request (SIOPv2 §9.2)

```
siopv2://?
  scope=openid%20profile
  &response_type=id_token
  &client_id=https%3A%2F%2Fclient.example.org%2Fpost_cb
  &redirect_uri=https%3A%2F%2Fclient.example.org%2Fpost_cb
  &response_mode=post
  &client_metadata=%7B%22subject_syntax_types_supported%22%3A
  %5B%22urn%3Aietf%3Aparams%3Aoauth%3Ajwk-thumbprint%22%5D%2C%0A%20%20%20%20
  %22id_token_signed_response_alg%22%3A%22ES256%22%7D
  &nonce=n-0S6_WzA2Mj
```

## 10. Cross-Device with request_uri method (SIOPv2 §9.2)

```
siopv2://?
  client_id=https%3A%2F%2Fclient.example.org%2Fcb
  &request_uri=https%3A%2F%2Fclient.example.org%2Frequest%2FGkurKxf5T0Y-mnPFCHqWOMiZi4VS138cQO_V7PZHAdM
```

Request Object payload:
```json
{
  "alg": "ES256",
  "kid": "did:example:EiDri#sign1",
  "typ": "oauth-authz-req+jwt"
}.
{
  "client_id": "did:example:EiDri",
  "scope": "openid profile",
  "response_type": "id_token",
  "redirect_uri": "https://client.example.org/cb",
  "client_metadata": {
    "subject_syntax_types_supported": ["did:example"],
    "id_token_signed_response_alg": "ES256"
  },
  "nonce": "n-0S6_WzA2Mj"
}.[signature]
```
