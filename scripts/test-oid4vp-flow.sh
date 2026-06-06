#!/bin/bash
# Simulate OID4VP wallet flow for testing
# Usage: bash scripts/test-oid4vp-flow.sh

set -e

BASE="https://demo.identitylab.id"

echo "=== Step 1: Initiate OpenID4VP request ==="
INIT=$(curl -s -X POST "$BASE/api/auth/openid4vp-request" \
  -H 'Content-Type: application/json')

SESSION_ID=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['sessionId'])")
OPENID4VP_URI=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['openid4vpUri'])")
echo "Session: $SESSION_ID"
echo "OpenID4VP URI: $OPENID4VP_URI"
echo ""

echo "=== Step 2: Create a test Verifiable Credential ==="
VC_RESP=$(curl -s -X POST "$BASE/api/vc/create" \
  -H 'Content-Type: application/json' \
  -d '{
    "subjectDid": "did:key:z6MkhaXgBZDvB9hU9VxKxQyLc8vCzYxFqRzPBmZKAfu6JpQh",
    "claims": {
      "name": "Alice Johnson",
      "role": "Student",
      "id_number": "STU-2024-00789",
      "faculty": "Faculty of Computer Science"
    }
  }')

CRED_JWT=$(echo "$VC_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['jwt'])")
echo "VC JWT created: ${CRED_JWT:0:50}..."

# Decode the state from the request JWT for the callback
REQUEST_JWT=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['requestJwt'])")
STATE=$(echo "$REQUEST_JWT" | cut -d. -f2 | python3 -c "
import sys,base64,json
padded = sys.stdin.read().strip() + '=='
d = json.loads(base64.urlsafe_b64decode(padded))
print(d['state'])
")
echo "State: $STATE"
echo ""

echo "=== Step 3: Simulate wallet callback (POST vp_token) ==="
VP_TOKEN=$(python3 -c "import json; print(json.dumps({'academic_credential': ['$CRED_JWT']}))")

CB_RESP=$(curl -s -X POST "$BASE/auth/callback" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  -d "vp_token=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$VP_TOKEN'))")&state=$STATE")

SESSION_TOKEN=$(echo "$CB_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['sessionToken'])")
echo "Session token: $SESSION_TOKEN"
echo ""

echo "=== Step 4: Fetch credential via API ==="
echo ""
curl -s "$BASE/api/auth/credential?token=$SESSION_TOKEN" | python3 -m json.tool
echo ""

echo "=== SUCCESS ==="
echo "Open these URLs in your browser:"
echo "  Dashboard:  $BASE/dashboard?session=$SESSION_TOKEN"
echo "  Credential: $BASE/credential?session=$SESSION_TOKEN"
