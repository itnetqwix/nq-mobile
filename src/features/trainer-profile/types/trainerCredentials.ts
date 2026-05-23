export type TrainerCertificate = {
  id: string;
  title: string;
  issuer: string;
  issued_at?: string;
  expires_at?: string;
  credential_url?: string;
  document_url?: string;
};

export type TrainerWorkExperience = {
  id: string;
  title: string;
  company?: string;
  location: string;
  start_date: string;
  end_date?: string;
  is_current?: boolean;
  description?: string;
};

export type TrainerDegree = {
  id: string;
  degree: string;
  field_of_study?: string;
  institution: string;
  location?: string;
  graduation_year?: string;
  description?: string;
};

export type TrainerCredentialsExtraInfo = {
  certificates?: TrainerCertificate[];
  work_experience?: TrainerWorkExperience[];
  degrees?: TrainerDegree[];
  profile_setup_completed_at?: string;
  profile_setup_skipped_at?: string;
};

export function newCredentialId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
