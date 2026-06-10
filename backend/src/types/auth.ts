export type SynzappRole = 'ORG_ADMIN' | 'DEPT_ADMIN' | 'EMPLOYEE' | 'SYSTEM_ADMIN';
export type SynzappUserStatus =
  | 'ACTIVE'
  | 'INVITED'
  | 'PENDING_PROFILE'
  | 'DEACTIVATED'
  | 'SUSPENDED'
  | 'ARCHIVED'
  | 'DELETED';
export type SessionAccess = 'ACTIVE' | 'PROFILE_REQUIRED' | 'BLOCKED';
export type SessionNextStep = 'OPEN_APP' | 'CREATE_PROFILE' | 'CONTACT_ADMIN' | 'SIGN_IN_AGAIN';

export interface IdentityDirectoryRecord {
  departmentAdminPermissions?: string[];
  departmentId?: string;
  tenantId?: string;
  role?: SynzappRole;
  status?: SynzappUserStatus;
  permissions?: string[];
  profileComplete?: boolean;
  claimsVersion?: number;
  displayName?: string;
  phoneLast4?: string;
  authRevokedAt?: FirebaseDateLike;
}

export interface ApprovedPhoneRecord {
  departmentAdminPermissions?: string[];
  departmentId?: string;
  tenantId: string;
  role: SynzappRole;
  status: 'INVITED' | 'ACTIVE' | 'DISABLED' | 'DEACTIVATED' | 'ARCHIVED' | 'DELETED';
  permissions?: string[];
  phoneLast4?: string;
}

export interface FirebaseDateLike {
  toMillis?: () => number;
  seconds?: number;
}

export interface AuthSessionResponse {
  access: SessionAccess;
  nextStep: SessionNextStep;
  claimsRefreshed: boolean;
  user: {
    departmentId?: string;
    uid: string;
    phoneMasked: string;
    tenantId?: string;
    role?: SynzappRole;
    status?: SynzappUserStatus;
    permissions: string[];
    profileComplete: boolean;
  };
}
