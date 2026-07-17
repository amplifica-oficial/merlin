import {Controller, Delete, Get, Middleware, Patch, Post} from '@overnightjs/core';
import type {NextFunction, Request, Response} from 'express';
import {MembershipSchemas, UtilitySchemas} from '@merlin/shared';

import {ALLOWLIST_RESTRICTED} from '../app/constants.js';
import {prisma} from '../database/prisma.js';
import {HttpException, NotAllowed, NotAuthenticated} from '../exceptions/index.js';
import {requireAuth, requireEmailVerified} from '../middleware/auth.js';
import {AllowlistService} from '../services/AllowlistService.js';
import {MembershipService} from '../services/MembershipService.js';
import {ProjectShareService} from '../services/ProjectShareService.js';
import {SecurityService} from '../services/SecurityService.js';
import {UserService} from '../services/UserService.js';
import {CatchAsync} from '../utils/asyncHandler.js';
import {normalizeEmail} from '../utils/email.js';

@Controller('projects')
export class Projects {
  /**
   * Get project setup state for dashboard quick start
   * GET /projects/:id/setup-state
   */
  @Get(':id/setup-state')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  private async getSetupState(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {id} = UtilitySchemas.id.parse(req.params);

    // Verify user has access to this project
    await MembershipService.requireAccess(auth.userId!, id);

    // Get project with relevant data
    const project = await prisma.project.findUnique({
      where: {id},
      select: {
        subscription: true,
        _count: {
          select: {
            contacts: true,
            domains: {
              where: {verified: true},
            },
            workflows: {
              where: {enabled: true},
            },
          },
        },
      },
    });

    if (!project) {
      throw new HttpException(404, 'Project not found');
    }

    // Get last sent campaign
    const lastCampaign = await prisma.campaign.findFirst({
      where: {
        projectId: id,
        status: 'SENT',
        sentAt: {not: null},
      },
      orderBy: {
        sentAt: 'desc',
      },
      select: {
        sentAt: true,
      },
    });

    return res.json({
      success: true,
      data: {
        hasSubscription: !!project.subscription,
        hasVerifiedDomain: project._count.domains > 0,
        contactCount: project._count.contacts,
        lastCampaignSentAt: lastCampaign?.sentAt || null,
        hasEnabledWorkflow: project._count.workflows > 0,
      },
    });
  }

  /**
   * Get project security metrics
   * GET /projects/:id/security
   */
  @Get(':id/security')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  private async getSecurityMetrics(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {id} = UtilitySchemas.id.parse(req.params);

    // Verify user has access to this project
    await MembershipService.requireAccess(auth.userId!, id);

    // Use existing SecurityService
    const metrics = await SecurityService.getProjectSecurityMetrics(id);

    return res.json({
      success: true,
      data: metrics,
    });
  }

  /**
   * Get all members of a project
   * GET /projects/:id/members
   */
  @Get(':id/members')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  private async getMembers(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {id} = UtilitySchemas.id.parse(req.params);

    // Verify user has access to this project
    await MembershipService.requireAccess(auth.userId!, id);

    // Get all members of the project
    const members = await MembershipService.getMembers(id);

    return res.json({
      success: true,
      data: members,
    });
  }

  /**
   * Get pending invites for a project
   * GET /projects/:id/pending-members
   */
  @Get(':id/pending-members')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  private async getPendingMembers(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {id} = UtilitySchemas.id.parse(req.params);

    await MembershipService.requireAccess(auth.userId!, id);

    const pendingMembers = await ProjectShareService.listPendingShares(id);

    return res.json({
      success: true,
      data: pendingMembers,
    });
  }

  /**
   * Add a member to a project by email
   * POST /projects/:id/members
   * Body: { email: string, role?: 'ADMIN' | 'MEMBER' }
   */
  @Post(':id/members')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  private async addMember(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {id} = UtilitySchemas.id.parse(req.params);

    // Validate params
    if (!id) {
      throw new HttpException(400, 'Project ID is required');
    }

    // Validate and parse request body
    const parseResult = MembershipSchemas.addMember.safeParse(req.body);
    if (!parseResult.success) {
      throw new HttpException(400, parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const {email, role} = parseResult.data;
    const normalized = normalizeEmail(email);

    // Verify current user is ADMIN or OWNER
    await MembershipService.requireAdminAccess(auth.userId!, id);

    const isExternal = !AllowlistService.isTrustedDomain(normalized);
    const effectiveRole = AllowlistService.resolveEffectiveRole(normalized, role);

    if (isExternal) {
      const allowlisted = await AllowlistService.isAllowlisted(normalized);

      if (!allowlisted) {
        if (ALLOWLIST_RESTRICTED) {
          const inviter = await UserService.id(auth.userId!);

          if (!inviter) {
            throw new NotAuthenticated();
          }

          if (!AllowlistService.isTrustedDomain(inviter.email)) {
            throw new NotAllowed('Only allowlist managers can invite external email addresses');
          }

          await AllowlistService.add(normalized, auth.userId!, {projectIds: [id]});
        } else {
          await ProjectShareService.shareWithEmail(normalized, [id], 'MEMBER', auth.userId!);
        }

        const invitedUser = await UserService.email(normalized);
        if (!invitedUser) {
          return res.json({
            success: true,
            data: {email: normalized, pending: true, role: 'MEMBER'},
          });
        }

        const membership = await MembershipService.getMembership(invitedUser.id, id);
        return res.json({
          success: true,
          data: {
            userId: invitedUser.id,
            email: invitedUser.email,
            role: membership?.role ?? 'MEMBER',
          },
        });
      }

      const invitedUser = await UserService.email(normalized);
      if (!invitedUser) {
        await ProjectShareService.shareWithEmail(normalized, [id], 'MEMBER', auth.userId!);

        return res.json({
          success: true,
          data: {email: normalized, pending: true, role: 'MEMBER'},
        });
      }
    }

    const userToAdd = await UserService.email(normalized);

    if (!userToAdd) {
      throw new HttpException(404, 'User with this email does not have an account');
    }

    const existingMembership = await MembershipService.getMembership(userToAdd.id, id);
    if (existingMembership) {
      return res.json({
        success: true,
        data: {
          userId: userToAdd.id,
          email: userToAdd.email,
          role: existingMembership.role,
        },
      });
    }

    const newMembership = await MembershipService.addMember(id, userToAdd.id, effectiveRole);

    return res.json({
      success: true,
      data: {
        userId: userToAdd.id,
        email: userToAdd.email,
        role: newMembership.role,
      },
    });
  }

  /**
   * Update a member's role
   * PATCH /projects/:id/members/:userId
   * Body: { role: 'ADMIN' | 'MEMBER' }
   */
  @Patch(':id/members/:userId')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  private async updateMemberRole(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {id, userId} = req.params;

    // Validate params
    if (!id) {
      throw new HttpException(400, 'Project ID is required');
    }
    if (!userId) {
      throw new HttpException(400, 'User ID is required');
    }

    // Validate and parse request body
    const parseResult = MembershipSchemas.updateRole.safeParse(req.body);
    if (!parseResult.success) {
      throw new HttpException(400, parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const {role} = parseResult.data;

    // Verify current user is ADMIN or OWNER
    await MembershipService.requireAdminAccess(auth.userId!, id);

    // Get user info
    const user = await prisma.user.findUnique({
      where: {id: userId},
      select: {id: true, email: true},
    });

    if (!user) {
      throw new HttpException(404, 'User not found');
    }

    const effectiveRole = AllowlistService.resolveEffectiveRole(user.email, role);

    // Update role (service handles validation)
    await MembershipService.updateRole(id, userId, effectiveRole);

    return res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        role: effectiveRole,
      },
    });
  }

  /**
   * Remove a member from a project
   * DELETE /projects/:id/members/:userId
   */
  @Delete(':id/members/:userId')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  private async removeMember(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {id, userId} = req.params;

    // Validate params
    if (!id) {
      throw new HttpException(400, 'Project ID is required');
    }
    if (!userId) {
      throw new HttpException(400, 'User ID is required');
    }

    // Verify current user is ADMIN or OWNER
    await MembershipService.requireAdminAccess(auth.userId!, id);

    // Cannot remove yourself
    if (userId === auth.userId) {
      throw new HttpException(403, 'You cannot remove yourself from the project');
    }

    // Remove member (service handles validation)
    await MembershipService.removeMember(id, userId);

    return res.json({
      success: true,
      data: {message: 'Member removed successfully'},
    });
  }

  /**
   * Revoke a pending invite for a project
   * DELETE /projects/:id/pending-members/:shareId
   */
  @Delete(':id/pending-members/:shareId')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  private async revokePendingMember(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {id, shareId} = req.params;

    if (!id) {
      throw new HttpException(400, 'Project ID is required');
    }
    if (!shareId) {
      throw new HttpException(400, 'Share ID is required');
    }

    await MembershipService.requireAdminAccess(auth.userId!, id);

    await ProjectShareService.revokePendingShare(id, shareId);

    return res.json({
      success: true,
      data: {message: 'Pending invite revoked successfully'},
    });
  }
}
