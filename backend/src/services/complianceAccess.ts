import { DecodedIdToken } from 'firebase-admin/auth';
import { buildAuthSession } from './authSessionService.js';

/**
 * Who may see and change a tenant's retention settings.
 *
 * Retention and legal hold decide whether a company's records survive, so the
 * gate is the same one used for security settings rather than a looser one: an
 * active Org Admin session with the security permission. A department admin who
 * can manage their own people has no business setting a policy that deletes the
 * organization's history.
 */

export interface ComplianceAdminContext {
  permissions: string[];
  tenantId: string;
  uid: string;
}

export async function requireComplianceAdmin(
  decodedToken: DecodedIdToken
): Promise<ComplianceAdminContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your admin session is not active.');
  }

  if (role !== 'ORG_ADMIN' || !permissions.includes('security.manage')) {
    throw authorizationError('You do not have permission to manage retention and legal holds.');
  }

  return { permissions, tenantId, uid: decodedToken.uid };
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';

  return error;
}
