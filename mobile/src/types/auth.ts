import type { User } from 'firebase/auth';

export type AuthStep = 'phone' | 'code' | 'role-select' | 'org-admin' | 'employee' | 'chat';
export type ProfileRoleSelection = 'ORG_ADMIN' | 'EMPLOYEE';

export interface FirebasePhoneSession {
  verificationId: string;
  phoneNumber: string;
}

export interface OrgAdminDraft {
  companyName: string;
  companyAddress: string;
  adminFirstName: string;
  adminLastName: string;
}

export interface EmployeeDraft {
  employeeFirstName: string;
  employeeLastName: string;
}

export interface VerifiedOrgAdmin {
  firebaseUser: User;
  idToken: string;
  phoneNumber: string;
  session: BackendAuthSession;
}

export type BackendSessionAccess = 'ACTIVE' | 'PROFILE_REQUIRED' | 'BLOCKED';
export type BackendSessionNextStep = 'OPEN_APP' | 'CREATE_PROFILE' | 'CONTACT_ADMIN' | 'SIGN_IN_AGAIN';

export interface BackendAuthSession {
  access: BackendSessionAccess;
  nextStep: BackendSessionNextStep;
  claimsRefreshed: boolean;
  user: {
    departmentId?: string;
    uid: string;
    phoneMasked: string;
    tenantId?: string;
    role?: 'ORG_ADMIN' | 'DEPT_ADMIN' | 'EMPLOYEE' | 'SYSTEM_ADMIN';
    status?: 'ACTIVE' | 'INVITED' | 'PENDING_PROFILE' | 'DEACTIVATED' | 'SUSPENDED' | 'ARCHIVED' | 'DELETED';
    permissions: string[];
    profileComplete: boolean;
  };
}
