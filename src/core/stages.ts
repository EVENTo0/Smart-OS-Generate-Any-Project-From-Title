export const stages = ["DRAFT_IDEA","RESEARCHING","QUESTIONNAIRE_READY","DNA_APPROVED","BLUEPRINT_READY","BUILDING","VERIFYING","RELEASED"] as const;
export type Stage = (typeof stages)[number];
