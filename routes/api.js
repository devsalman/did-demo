import express from 'express';

const router = express.Router();

// Create VC endpoint
router.post('/vc/create', (req, res) => {
  try {
    console.log('HEADERS:', req.headers)
    console.log('BODY:', req.body)
    const { subjectDid, claims } = req.body;

    // Validation
    if (!claims || Object.keys(claims).length === 0) {
      return res.status(400).json({ error: 'At least one claim is required' });
    }

    // Use provided DID or auto-generate
    const credentialSubjectId = subjectDid || generateDidKey();

    // Build credential subject with claims
    const credentialSubject = {
      id: credentialSubjectId,
      ...claims,
    };

    // W3C VC structure
    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/2018/credentials/examples/v1',
      ],
      type: ['VerifiableCredential'],
      id: `urn:uuid:asdf1234567890`, // In production, use a real UUID
      issuer: 'did:web:identitylab.id',
      issuanceDate: new Date().toISOString(),
      credentialSubject,
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        verificationMethod: `did:web:identitylab.id#key-1`,
        proofPurpose: 'assertionMethod',
        proofValue: 'asdf1234567890',
      },
    };

    res.json({
      success: true,
      credential,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;