import type {Role} from '@merlin/db';
import type {AuthResponse} from '@merlin/types';

import {NotAllowed, NotAuthenticated} from '../exceptions/index.js';
import {AllowlistService} from './AllowlistService.js';
import {MembershipService} from './MembershipService.js';
import {UserService} from './UserService.js';

export type FileDeleteActor =
  | {type: 'apiKey'}
  | {
      type: 'jwt';
      userId: string;
      email: string;
      role: Role;
    };

export function canDeleteProjectFile(actor: FileDeleteActor, file: {createdById: string | null}): boolean {
  if (actor.type === 'apiKey') {
    return true;
  }

  if (AllowlistService.hasTrustedDomains() && AllowlistService.isTrustedDomain(actor.email)) {
    return true;
  }

  if (file.createdById) {
    return file.createdById === actor.userId;
  }

  return actor.role === 'OWNER' || actor.role === 'ADMIN';
}

export function assertCanDeleteProjectFile(actor: FileDeleteActor, file: {createdById: string | null}): void {
  if (!canDeleteProjectFile(actor, file)) {
    throw new NotAllowed('You do not have permission to delete this file.');
  }
}

export async function resolveFileDeleteActor(auth: AuthResponse): Promise<FileDeleteActor> {
  if (auth.type === 'apiKey' || !auth.userId) {
    return {type: 'apiKey'};
  }

  const [user, membership] = await Promise.all([
    UserService.id(auth.userId),
    MembershipService.getMembership(auth.userId, auth.projectId),
  ]);

  if (!user) {
    throw new NotAuthenticated();
  }

  if (!membership) {
    throw new NotAllowed('You do not have permission to delete this file.');
  }

  return {
    type: 'jwt',
    userId: user.id,
    email: user.email,
    role: membership.role,
  };
}
