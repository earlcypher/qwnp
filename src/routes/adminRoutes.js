import express from 'express';
import {
  createApiKey,
  listApiKeys,
  getApiKey,
  updateApiKey,
  deleteApiKey,
  getUsageStats
} from '../services/apiKeyService.js';
import { requireAdmin } from '../middleware/authMiddleware.js';
import supabase from '../supabaseClient.js';

const router = express.Router();

/**
 * Admin Routes
 * All routes require enterprise tier API key (admin access)
 */

/**
 * POST /admin/api-keys
 * Create a new API key
 *
 * Body:
 * {
 *   "name": "My API Key",
 *   "tier": "free" | "premium" | "enterprise"
 * }
 */
router.post('/api-keys', requireAdmin, async (req, res) => {
  try {
    const { name, tier = 'free' } = req.body;

    if (!name) {
      return res.status(400).json({
        error: {
          message: 'Missing required field: name',
          type: 'validation_error',
          code: 'missing_name'
        }
      });
    }

    if (!['free', 'premium', 'enterprise'].includes(tier)) {
      return res.status(400).json({
        error: {
          message: 'Invalid tier. Must be: free, premium, or enterprise',
          type: 'validation_error',
          code: 'invalid_tier'
        }
      });
    }

    const apiKey = await createApiKey({ name, tier });

    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        key: apiKey.key, // Only returned on creation
        name: apiKey.name,
        tier: apiKey.tier,
        is_active: apiKey.is_active,
        created_at: apiKey.created_at
      }
    });
  } catch (error) {
    console.error('[Admin] Create API key error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create API key',
        type: 'internal_error',
        code: 'creation_failed'
      }
    });
  }
});

/**
 * GET /admin/api-keys
 * List all API keys
 *
 * Query params:
 * - active_only: true | false (default: false)
 */
router.get('/api-keys', requireAdmin, async (req, res) => {
  try {
    const activeOnly = req.query.active_only === 'true';
    const keys = await listApiKeys({ activeOnly });

    res.json({
      success: true,
      data: keys.map(k => ({
        id: k.id,
        name: k.name,
        tier: k.tier,
        is_active: k.is_active,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
        usage_count: k.usage_count
        // Note: key value is never returned in list/get operations for security
      })),
      count: keys.length
    });
  } catch (error) {
    console.error('[Admin] List API keys error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to list API keys',
        type: 'internal_error',
        code: 'list_failed'
      }
    });
  }
});

/**
 * GET /admin/api-keys/:id
 * Get specific API key by ID
 */
router.get('/api-keys/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // We need to get by ID, but our getApiKey function gets by key string
    // So we'll use a direct Supabase query here
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, tier, is_active, created_at, last_used_at, usage_count')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: {
          message: 'API key not found',
          type: 'not_found',
          code: 'key_not_found'
        }
      });
    }

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('[Admin] Get API key error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get API key',
        type: 'internal_error',
        code: 'get_failed'
      }
    });
  }
});

/**
 * PUT /admin/api-keys/:id
 * Update API key
 *
 * Body:
 * {
 *   "name": "Updated name",
 *   "tier": "premium",
 *   "is_active": true
 * }
 */
router.put('/api-keys/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, tier, is_active } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (tier !== undefined) {
      if (!['free', 'premium', 'enterprise'].includes(tier)) {
        return res.status(400).json({
          error: {
            message: 'Invalid tier. Must be: free, premium, or enterprise',
            type: 'validation_error',
            code: 'invalid_tier'
          }
        });
      }
      updates.tier = tier;
    }
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: {
          message: 'No updates provided',
          type: 'validation_error',
          code: 'no_updates'
        }
      });
    }

    const updatedKey = await updateApiKey(id, updates);

    res.json({
      success: true,
      data: {
        id: updatedKey.id,
        name: updatedKey.name,
        tier: updatedKey.tier,
        is_active: updatedKey.is_active,
        created_at: updatedKey.created_at,
        last_used_at: updatedKey.last_used_at,
        usage_count: updatedKey.usage_count
      }
    });
  } catch (error) {
    console.error('[Admin] Update API key error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update API key',
        type: 'internal_error',
        code: 'update_failed'
      }
    });
  }
});

/**
 * DELETE /admin/api-keys/:id
 * Delete (deactivate) API key
 */
router.delete('/api-keys/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedKey = await deleteApiKey(id);

    res.json({
      success: true,
      message: 'API key deactivated successfully',
      data: {
        id: deletedKey.id,
        name: deletedKey.name,
        is_active: deletedKey.is_active
      }
    });
  } catch (error) {
    console.error('[Admin] Delete API key error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete API key',
        type: 'internal_error',
        code: 'delete_failed'
      }
    });
  }
});

/**
 * GET /admin/stats
 * Get usage statistics
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getUsageStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Admin] Get stats error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get statistics',
        type: 'internal_error',
        code: 'stats_failed'
      }
    });
  }
});

export default router;
