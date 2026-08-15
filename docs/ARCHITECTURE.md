# Architecture

## Pipeline
TITLE / IDEA → Intake → Domain Classification → Research → Evidence → Comparable Graph → Reverse Specification → Adaptive Questionnaire → User + AI Answers → Decision Gates → Project DNA → 0→Production Blueprint → Agent/Skill Routing → Isolated Workspace → Build → Test/Eval → Preview → Release → Improve.

## Four truth layers
- Facts: evidence-backed claims.
- Inferences: reasoned conclusions.
- User decisions: explicit preferences and constraints.
- AI defaults: provisional choices when unanswered.

These layers must never be silently merged.

## Runtime direction
- Orchestrator: TypeScript service
- State: PostgreSQL/Supabase or SQLite for prototype
- Artifacts: Git + object storage
- Providers: OpenAI, Anthropic, Kimi adapters
- Execution: isolated sandbox/container per generated project
- Frontend: phone-first PWA/control plane
- CI: GitHub Actions
