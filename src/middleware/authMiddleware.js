import { validateApiKey, updateUsageStats } from '../services/apiKeyService.js';
import supabase from '../supabaseClient.js';

/**
 * Authentication Middleware
 * Validates API keys and protects endpoints
 */

/**
 * Extract API key from Authorization header
 * Supports: "Bearer sk-xxx" or "sk-xxx"
 */
function extractApiKey(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Handle "Bearer sk-xxx" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Handle "sk-xxx" format
  return authHeader;
}

/**
 * Require authentication middleware
 * Validates API key and attaches key info to request
 */
export async function requireAuth(req, res, next) {
  // If Supabase not configured, authentication is disabled
  if (!supabase) {
    console.log('[Auth] Supabase not configured - authentication disabled');
    return next();
  }

  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return res.status(401).json({
      error: {
        message: 'Authentication required. Provide API key in Authorization header.',
        type: 'authentication_error',
        code: 'missing_api_key'
      }
    });
  }

  try {
    const validKey = await validateApiKey(apiKey);

    if (!validKey) {
      return res.status(401).json({
        error: {
          message: 'Invalid or inactive API key.',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      });
    }

    // Attach key info to request for downstream use
    req.apiKey = validKey;
    req.tier = validKey.tier;

    // Update usage statistics (non-blocking)
    updateUsageStats(validKey.id).catch(err => {
      console.error('[Auth] Failed to update usage stats:', err);
    });

    next();
  } catch (error) {
    console.error('[Auth] Validation error:', error);
    return res.status(500).json({
      error: {
        message: 'Authentication service error.',
        type: 'internal_error',
        code: 'auth_service_error'
      }
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches key info if present, but doesn't reject if missing
 * Useful for endpoints that benefit from knowing the user but don't require it
 */
export async function optionalAuth(req, res, next) {
  if (!supabase) {
    return next();
  }

  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return next();
  }

  try {
    const validKey = await validateApiKey(apiKey);

    if (validKey) {
      req.apiKey = validKey;
      req.tier = validKey.tier;

      // Update usage statistics (non-blocking)
      updateUsageStats(validKey.id).catch(err => {
        console.error('[Auth] Failed to update usage stats:', err);
      });
    }
  } catch (error) {
    console.error('[Auth] Optional validation error:', error);
    // Don't fail the request - just continue without auth
  }

  next();
}

/**
 * Enterprise tier check middleware
 * Use after requireAuth in middleware chain
 */
export function requireEnterprise(req, res, next) {
  if (req.tier !== 'enterprise') {
    return res.status(403).json({
      error: {
        message: 'Admin access required. Enterprise tier API key needed.',
        type: 'authorization_error',
        code: 'insufficient_permissions'
      }
    });
  }

  next();
}
