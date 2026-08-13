# Gate 2 — Live Research & Evidence

Goal: turn a project title into a cited evidence dossier before evidence-derived decisions enter Project DNA.

## Required pipeline

Title → Research Plan → Source Discovery → Source Ranking → Claim Extraction → Confidence Scoring → Comparable Patterns → Questionnaire Enrichment → Project DNA.

## Truth separation

Every item must remain one of:
- Fact: directly supported by source evidence.
- Inference: reasoned conclusion derived from facts.
- User Decision: explicit user choice.
- AI Default: provisional recommendation when unanswered.

No inference or AI default may be silently stored as a fact.

## Source priority

1. Official developer/product documentation
2. Standards and primary research
3. Publisher/developer materials
4. Reputable technical references
5. High-quality secondary analysis
6. Community observations

## Gate acceptance

- each research-derived claim references one or more sources
- confidence is explicit
- unsupported claims cannot become hard build requirements
- comparable projects are used for patterns, not protected copying
- research never grants write access to external repositories
- evidence can be reproduced/audited later
