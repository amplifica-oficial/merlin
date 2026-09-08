import {beforeEach, describe, expect, it, vi} from 'vitest';

import {NotAllowed, NotAuthenticated} from '../../exceptions/index.js';

import {AllowlistService} from '../AllowlistService.js';
import {MembershipService} from '../MembershipService.js';
import {UserService} from '../UserService.js';
import {
  assertCanDeleteProjectFile,
  canDeleteProjectFile,
  resolveFileDeleteActor,
  type FileDeleteActor,
} from '../fileDeleteAuth';

vi.mock('../AllowlistService.js', () => ({
  AllowlistService: {
    hasTrustedDomains: vi.fn(() => false),
    isTrustedDomain: vi.fn(() => false),
  },
}));

vi.mock('../MembershipService.js', () => ({
  MembershipService: {
    getMembership: vi.fn(),
  },
}));

vi.mock('../UserService.js', () => ({
  UserService: {
    id: vi.fn(),
  },
}));

const apiKeyActor: FileDeleteActor = {type: 'apiKey'};
const creator: FileDeleteActor = {
  type: 'jwt',
  userId: 'user-1',
  email: 'owner@company.com',
  role: 'OWNER',
};
const otherMember: FileDeleteActor = {
  type: 'jwt',
  userId: 'user-2',
  email: 'guest@example.com',
  role: 'MEMBER',
};
const admin: FileDeleteActor = {
  type: 'jwt',
  userId: 'user-3',
  email: 'admin@company.com',
  role: 'ADMIN',
};

describe('canDeleteProjectFile', () => {
  beforeEach(() => {
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(false);
    vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(false);
  });

  it('allows API key auth', () => {
    expect(canDeleteProjectFile(apiKeyActor, {createdById: 'user-2'})).toBe(true);
  });

  it('allows the creator when trusted domains are not configured', () => {
    expect(canDeleteProjectFile(creator, {createdById: 'user-1'})).toBe(true);
  });

  it('blocks a non-creator when trusted domains are not configured', () => {
    expect(canDeleteProjectFile(otherMember, {createdById: 'user-1'})).toBe(false);
  });

  it('allows OWNER/ADMIN to delete legacy files without a creator', () => {
    expect(canDeleteProjectFile(creator, {createdById: null})).toBe(true);
    expect(canDeleteProjectFile(admin, {createdById: null})).toBe(true);
    expect(canDeleteProjectFile(otherMember, {createdById: null})).toBe(false);
  });

  it('allows the creator even when they are not on a trusted domain', () => {
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(true);
    vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(false);

    expect(canDeleteProjectFile(otherMember, {createdById: 'user-2'})).toBe(true);
    expect(canDeleteProjectFile(otherMember, {createdById: 'user-1'})).toBe(false);
  });

  it('allows trusted-domain users to delete any file', () => {
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(true);
    vi.mocked(AllowlistService.isTrustedDomain).mockImplementation(email => email.endsWith('@company.com'));

    expect(canDeleteProjectFile(creator, {createdById: 'user-2'})).toBe(true);
    expect(canDeleteProjectFile(admin, {createdById: 'user-2'})).toBe(true);
    expect(canDeleteProjectFile(otherMember, {createdById: 'user-1'})).toBe(false);
  });
});

describe('assertCanDeleteProjectFile', () => {
  beforeEach(() => {
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(false);
    vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(false);
  });

  it('throws NotAllowed when the actor cannot delete', () => {
    expect(() => assertCanDeleteProjectFile(otherMember, {createdById: 'user-1'})).toThrow(NotAllowed);
  });
});

describe('resolveFileDeleteActor', () => {
  beforeEach(() => {
    vi.mocked(UserService.id).mockReset();
    vi.mocked(MembershipService.getMembership).mockReset();
  });

  it('returns an API key actor for API key auth', async () => {
    await expect(resolveFileDeleteActor({type: 'apiKey', projectId: 'p1'})).resolves.toEqual({type: 'apiKey'});
  });

  it('throws NotAuthenticated when the user is missing', async () => {
    vi.mocked(UserService.id).mockResolvedValue(null);
    vi.mocked(MembershipService.getMembership).mockResolvedValue({role: 'MEMBER'} as never);

    await expect(resolveFileDeleteActor({type: 'jwt', userId: 'u1', projectId: 'p1'})).rejects.toBeInstanceOf(
      NotAuthenticated,
    );
  });

  it('throws NotAllowed when the JWT user has no membership', async () => {
    vi.mocked(UserService.id).mockResolvedValue({id: 'u1', email: 'guest@example.com'} as never);
    vi.mocked(MembershipService.getMembership).mockResolvedValue(null);

    await expect(resolveFileDeleteActor({type: 'jwt', userId: 'u1', projectId: 'p1'})).rejects.toBeInstanceOf(
      NotAllowed,
    );
  });

  it('returns a JWT actor with the membership role', async () => {
    vi.mocked(UserService.id).mockResolvedValue({id: 'u1', email: 'admin@company.com'} as never);
    vi.mocked(MembershipService.getMembership).mockResolvedValue({role: 'ADMIN'} as never);

    await expect(resolveFileDeleteActor({type: 'jwt', userId: 'u1', projectId: 'p1'})).resolves.toEqual({
      type: 'jwt',
      userId: 'u1',
      email: 'admin@company.com',
      role: 'ADMIN',
    });
  });
});
