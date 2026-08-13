export interface GeneratedProjectFile {
  path: string;
  content: string;
}

export interface ImplementationBundle {
  projectId: string;
  templateId: string;
  files: GeneratedProjectFile[];
  requiresExternalExecution: false;
}

export interface ImplementationRequest {
  projectId: string;
  title: string;
  domain: string;
  targetPlatforms: string[];
  requirements: string[];
}
