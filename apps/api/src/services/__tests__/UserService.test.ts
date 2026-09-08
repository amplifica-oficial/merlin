import {beforeEach, describe, expect, it, vi} from 'vitest';

import {AllowlistService} from '../AllowlistService.js';
import {UserService} from '../UserService';
import {factories} from '../../../../../test/helpers';

vi.mock('../AllowlistService.js', () => ({
  AllowlistService: {
    hasTrustedDomains: vi.fn(() => false),
    isTrustedDomain: vi.fn(() => false),
  },
}));

describe('UserService.projects', () => {
  beforeEach(() => {
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(false);
    vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(false);
  });

  it('returns the secret when trusted domains are not configured', async () => {
    const {user, project} = await factories.createUserWithProject();

    const projects = await UserService.projects(user.id);

    expect(projects).toHaveLength(1);
    expect(projects[0]?.id).toBe(project.id);
    expect(projects[0]?.secret).toBe(project.secret);
  });

  it('redacts the secret for guests when trusted domains are configured', async () => {
    const {user, project} = await factories.createUserWithProject({email: 'guest@example.com'});
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(true);
    vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(false);

    const projects = await UserService.projects(user.id);

    expect(projects[0]?.id).toBe(project.id);
    expect(projects[0]?.secret).toBeNull();
  });

  it('keeps the secret for trusted-domain users', async () => {
    const {user, project} = await factories.createUserWithProject({email: 'owner@company.com'});
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(true);
    vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(true);

    const projects = await UserService.projects(user.id);

    expect(projects[0]?.secret).toBe(project.secret);
  });
});

describe('UserService.redactProjectSecret', () => {
  beforeEach(() => {
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(false);
    vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(false);
  });

  it('returns the project unchanged when trusted domains are not configured', () => {
    const project = {id: 'p1', public: 'pk_test', secret: 'sk_test'};

    expect(UserService.redactProjectSecret(project, 'guest@example.com').secret).toBe('sk_test');
  });

  it('redacts the secret for a guest on regenerate-keys style payloads', () => {
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(true);
    vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(false);

    const project = {
      id: 'p1',
      name: 'Guest project',
      public: 'pk_new',
      secret: 'sk_new',
      disabled: false,
      customer: null,
      subscription: null,
    };

    expect(UserService.redactProjectSecret(project, 'guest@example.com').secret).toBeNull();
    expect(UserService.redactProjectSecret(project, 'guest@example.com').public).toBe('pk_new');
  });

  it('keeps the secret for trusted-domain users', () => {
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(true);
    vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(true);

    const project = {id: 'p1', public: 'pk_test', secret: 'sk_test'};

    expect(UserService.redactProjectSecret(project, 'owner@company.com').secret).toBe('sk_test');
  });
});
