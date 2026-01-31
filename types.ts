
export interface AuthorizedUser {
  id: string;
  email: string;
  addedAt: number;
}

export interface EmailFormData {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  templateId: string;
  dynamicTemplateData: string;
}

export interface UserProfile {
  email: string;
  uid: string;
  displayName: string;
  photoURL: string;
  isAdmin: boolean;
  isAuthorized: boolean;
}
