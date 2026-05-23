Page: SSI Verifiable Credential Issuer
Overall
Theme: Dark brutalist. Near-black background (#080808), off-white text (#e8e8e2), electric green accent (#00ff88).
Fonts: JetBrains Mono (monospace, used everywhere) + Space Grotesk (sans-serif, used for the main heading and the CTA button).
Layout: Full-height page. Fixed header at top. Below it, a two-column grid (equal width, max-width: 1024px, centered, gap: 48px). On narrow viewports, stacks to a single column.
Header
Left: a shield-check icon + the text SSI / VC ISSUER in small, bold, widely letter-spaced caps.
Right: the word Demo in tiny muted caps.
Bottom border: thin hairline (rgba(white, 0.12)).
Left Column — Form
Heading block

Large bold heading (Space Grotesk): Issue a Verifiable / Credential on two lines. The word Credential is electric green.
Below: a small muted mono paragraph describing what the form does.
Subject DID field

Label: SUBJECT DID in tiny muted all-caps. Sub-label note: (leave blank to auto-generate).
Input: dark filled (#1a1a18), hairline border, rounded-sm, monospace text, placeholder did:key:z…. On focus, border turns electric green.
Claims section

Label: CLAIMS in tiny muted all-caps. Right-aligned: a live count like 2 fields.
Each claim row:
A narrow input (fixed ~144px) for the key.
A muted → separator.
A flex-grow input for the value.
A small trash icon button on the right (turns red on hover, disabled/faded if only 1 row remains).
Below each key input: inline error message (red, with a small alert icon) if the key is empty or duplicate.
Below all rows: a full-width dashed-border button with a + icon and Add field label. Dashes turn green on hover.
Create VC button

Full-width, electric green background, near-black text, bold Space Grotesk, CREATE VC in wide letter-spaced caps.
While submitting: spinner + Signing credential… text. Button is slightly faded/disabled.
Right Column — Output Panel
Label: OUTPUT in tiny muted all-caps. Right side (when output exists): Copy JSON link (with copy icon) + Reset link.
Main panel: tall bordered box (min-height: 520px), dark card background (#111110), hairline border, slight rounding.
States:

Idle: Centered shield icon in a bordered square + small muted text prompting the user to fill claims and press Create VC.
Creating: An 8×4 grid of small green squares, pulsing with staggered animation delay. Below: SIGNING… in tiny animated muted caps.
Success: Scrollable <pre> block of syntax-highlighted JSON:
Keys: dimmed/muted.
String values: full foreground white.
Brackets/braces: very faded.
The proof key line: electric green.
Sticky footer bar at the bottom of the panel: pulsing green dot + CREDENTIAL SIGNED in green caps + Ed25519Signature2020 muted on the right.
Error: Red alert icon + short error message with a Try again text link.
Below the panel: A tiny muted note — "Output conforms to W3C VC Data Model 1.1. Proof value is simulated — wire a real Ed25519 signer for production."

VC JSON Structure (output)
{
  "@context": ["https://www.w3.org/2018/credentials/v1", "…/examples/v1"],
  "type": ["VerifiableCredential"],
  "id": "urn:uuid:…",
  "issuer": "did:key:z…",
  "issuanceDate": "2026-…T…Z",
  "credentialSubject": {
    "id": "did:key:z…",
    "<key>": "<value>",
    …
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "…",
    "verificationMethod": "did:key:z…#key-1",
    "proofPurpose": "assertionMethod",
    "proofValue": "z<88-char base58 string>"
  }
}
Micro-interactions
Input borders animate to electric green on focus.
Trash icon fades and is non-interactive when only one claim row exists.
Copy button swaps to a checkmark + Copied in green for 2 seconds after click.
Create VC button slightly scales down on active.
The signing grid uses CSS animate-pulse with staggered animation-delay per cell.
