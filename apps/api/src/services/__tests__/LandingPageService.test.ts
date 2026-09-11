import {beforeEach, describe, expect, it} from 'vitest';
import {EMPTY_PUCK_DATA} from '@merlin/types';

import {factories, getPrismaClient} from '../../../../../test/helpers';
import {HttpException} from '../../exceptions/index.js';
import {LandingPageService} from '../LandingPageService.js';

const UUID_SLUG = '550e8400-e29b-41d4-a716-446655440000';

function uniqueSlug(prefix = 'page'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('LandingPageService', () => {
  const prisma = getPrismaClient();
  let projectId: string;

  beforeEach(async () => {
    const {project} = await factories.createUserWithProject();
    projectId = project.id;
  });

  describe('create', () => {
    it('creates a landing page with a generated publicId', async () => {
      const slug = uniqueSlug('launch');
      const page = await LandingPageService.create(projectId, {
        name: 'Launch',
        slug,
        data: EMPTY_PUCK_DATA,
        settings: {},
      });

      expect(page.projectId).toBe(projectId);
      expect(page.slug).toBe(slug);
      expect(page.publicId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(page.published).toBe(false);
    });

    it('rejects a slug already used in another project', async () => {
      const slug = uniqueSlug('shared');
      const {project: otherProject} = await factories.createUserWithProject();

      await LandingPageService.create(otherProject.id, {
        name: 'Other',
        slug,
        data: EMPTY_PUCK_DATA,
        settings: {},
      });

      await expect(
        LandingPageService.create(projectId, {
          name: 'Mine',
          slug,
          data: EMPTY_PUCK_DATA,
          settings: {},
        }),
      ).rejects.toMatchObject({
        code: 409,
        message: 'This slug is already taken',
      });
    });

    it('rejects a UUID-shaped slug', async () => {
      await expect(
        LandingPageService.create(projectId, {
          name: 'UUID',
          slug: UUID_SLUG,
          data: EMPTY_PUCK_DATA,
          settings: {},
        }),
      ).rejects.toMatchObject({
        code: 400,
        message: 'Slug cannot be a UUID',
      });
    });
  });

  describe('update', () => {
    it('allows keeping the current slug', async () => {
      const slug = uniqueSlug('keep');
      const page = await LandingPageService.create(projectId, {
        name: 'Keep',
        slug,
        data: EMPTY_PUCK_DATA,
        settings: {},
      });

      const updated = await LandingPageService.update(projectId, page.id, {
        name: 'Keep updated',
      });

      expect(updated.slug).toBe(slug);
      expect(updated.name).toBe('Keep updated');
    });

    it('changes the slug and frees the previous one', async () => {
      const oldSlug = uniqueSlug('old');
      const newSlug = uniqueSlug('new');
      const page = await LandingPageService.create(projectId, {
        name: 'Rename',
        slug: oldSlug,
        data: EMPTY_PUCK_DATA,
        settings: {},
      });

      const updated = await LandingPageService.update(projectId, page.id, {
        slug: newSlug,
      });

      expect(updated.slug).toBe(newSlug);
      await expect(LandingPageService.isSlugAvailable(oldSlug)).resolves.toEqual({available: true});
      await expect(LandingPageService.isSlugAvailable(newSlug, page.id)).resolves.toEqual({
        available: true,
      });
    });

    it('serves the new slug and publicId after a rename', async () => {
      const oldSlug = uniqueSlug('old-pub');
      const newSlug = uniqueSlug('new-pub');
      const page = await LandingPageService.create(projectId, {
        name: 'Public rename',
        slug: oldSlug,
        data: EMPTY_PUCK_DATA,
        settings: {},
        published: true,
      });

      await LandingPageService.update(projectId, page.id, {slug: newSlug});

      const byNewSlug = await LandingPageService.getPublicConfig(newSlug);
      const byPublicId = await LandingPageService.getPublicConfig(page.publicId);

      expect(byNewSlug.slug).toBe(newSlug);
      expect(byPublicId.slug).toBe(newSlug);
      expect(byPublicId.publicId).toBe(page.publicId);
      await expect(LandingPageService.getPublicConfig(oldSlug)).rejects.toMatchObject({code: 404});
    });

    it('rejects changing to a slug already used by another page', async () => {
      const takenSlug = uniqueSlug('taken');
      await LandingPageService.create(projectId, {
        name: 'Taken',
        slug: takenSlug,
        data: EMPTY_PUCK_DATA,
        settings: {},
      });

      const page = await LandingPageService.create(projectId, {
        name: 'Mine',
        slug: uniqueSlug('mine'),
        data: EMPTY_PUCK_DATA,
        settings: {},
      });

      await expect(
        LandingPageService.update(projectId, page.id, {slug: takenSlug}),
      ).rejects.toMatchObject({
        code: 409,
        message: 'This slug is already taken',
      });
    });

    it('rejects a UUID-shaped slug', async () => {
      const page = await LandingPageService.create(projectId, {
        name: 'UUID',
        slug: uniqueSlug('uuid'),
        data: EMPTY_PUCK_DATA,
        settings: {},
      });

      await expect(
        LandingPageService.update(projectId, page.id, {slug: UUID_SLUG}),
      ).rejects.toMatchObject({
        code: 400,
        message: 'Slug cannot be a UUID',
      });
    });
  });

  describe('getPublicConfig', () => {
    it('resolves a published page by slug and publicId', async () => {
      const slug = uniqueSlug('public');
      const page = await LandingPageService.create(projectId, {
        name: 'Public',
        slug,
        data: EMPTY_PUCK_DATA,
        settings: {title: 'Public title'},
        published: true,
      });

      const bySlug = await LandingPageService.getPublicConfig(slug);
      const byPublicId = await LandingPageService.getPublicConfig(page.publicId);

      expect(bySlug.slug).toBe(slug);
      expect(bySlug.publicId).toBe(page.publicId);
      expect(bySlug.name).toBe('Public');
      expect(bySlug.settings.title).toBe('Public title');
      expect(byPublicId).toEqual(bySlug);
    });

    it('returns 404 for an unpublished page', async () => {
      const slug = uniqueSlug('draft');
      await LandingPageService.create(projectId, {
        name: 'Draft',
        slug,
        data: EMPTY_PUCK_DATA,
        settings: {},
        published: false,
      });

      await expect(LandingPageService.getPublicConfig(slug)).rejects.toBeInstanceOf(HttpException);
      await expect(LandingPageService.getPublicConfig(slug)).rejects.toMatchObject({code: 404});
    });
  });

  describe('isSlugAvailable', () => {
    it('returns invalid and reserved reasons without hitting uniqueness', async () => {
      await expect(LandingPageService.isSlugAvailable('')).resolves.toEqual({
        available: false,
        reason: 'invalid',
      });
      await expect(LandingPageService.isSlugAvailable('Not Valid')).resolves.toEqual({
        available: false,
        reason: 'invalid',
      });
      await expect(LandingPageService.isSlugAvailable(UUID_SLUG)).resolves.toEqual({
        available: false,
        reason: 'reserved',
      });
    });

    it('treats an existing slug as taken unless excludeId matches', async () => {
      const slug = uniqueSlug('check');
      const page = await LandingPageService.create(projectId, {
        name: 'Check',
        slug,
        data: EMPTY_PUCK_DATA,
        settings: {},
      });

      await expect(LandingPageService.isSlugAvailable(slug)).resolves.toEqual({
        available: false,
        reason: 'taken',
      });
      await expect(LandingPageService.isSlugAvailable(slug, page.id)).resolves.toEqual({
        available: true,
      });
      await expect(LandingPageService.isSlugAvailable(uniqueSlug('open'))).resolves.toEqual({
        available: true,
      });
    });
  });

  describe('delete', () => {
    it('removes the page so the slug can be reused', async () => {
      const slug = uniqueSlug('gone');
      const page = await LandingPageService.create(projectId, {
        name: 'Gone',
        slug,
        data: EMPTY_PUCK_DATA,
        settings: {},
      });

      await LandingPageService.delete(projectId, page.id);

      await expect(prisma.landingPage.findUnique({where: {id: page.id}})).resolves.toBeNull();
      await expect(LandingPageService.isSlugAvailable(slug)).resolves.toEqual({available: true});
    });
  });
});
