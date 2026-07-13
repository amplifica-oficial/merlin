/**
 * Express.js type augmentation for Merlin platform
 * Extends Express Response.locals to include typed auth property
 */

import type {AuthResponse} from './index.js';

declare global {
	namespace Express {
		interface Locals {
			/**
			 * Authentication context for the current request
			 * Set by auth middleware (requireAuth, requireSecretKey, requirePublicKey)
			 */
			auth: AuthResponse;
		}
	}
}
