import express from 'express';
import {
  createApiKey,
  listApiKeys,
  getApiKey,
  updateApiKey,
  deleteApiKey,
  getUsageStats as getApiKeyStats
} from '../services/apiKeyService.js';
import {
  getRequestLogs,
  getUsageStats,
  getKeyStats
} from '../services/analyticsService.js';
import { requireAdmin } from '../middleware/authMiddleware.js';
import supabase from '../supabaseClient.js';
import cookieService from '../services/cookieService.js';

const router = express.Router();

/**
 * Admin Routes
 * All routes require enterprise tier API key (admin access)
 */

// ===== API Key Management Routes (existing) =====

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
        key: apiKey.key,
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

router.get('/api-keys/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

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

router.delete('/api-keys/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedKey = await deleteApiKey(id);

    res.json({
      success: true,
      message: 'API key deleted permanently',
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

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getApiKeyStats();

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

// ===== NEW: Analytics Routes =====

/**
 * GET /admin/analytics/logs
 * Get request logs with optional filters
 *
 * Query params:
 * - limit: number (default 100)
 * - offset: number (default 0)
 * - api_key_id: UUID (filter by specific key)
 * - status_code: number (filter by status)
 * - start_date: ISO date string
 * - end_date: ISO date string
 */
router.get('/analytics/logs', requireAdmin, async (req, res) => {
  try {
    const filters = {
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0,
      apiKeyId: req.query.api_key_id || null,
      statusCode: req.query.status_code ? parseInt(req.query.status_code) : null,
      startDate: req.query.start_date || null,
      endDate: req.query.end_date || null
    };

    const result = await getRequestLogs(filters);

    res.json({
      success: true,
      data: result.logs,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: result.total
      }
    });
  } catch (error) {
    console.error('[Admin] Get logs error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch request logs',
        type: 'internal_error',
        code: 'logs_fetch_failed'
      }
    });
  }
});

/**
 * GET /admin/analytics/usage
 * Get aggregated usage statistics
 *
 * Query params:
 * - days: number (default 7, last N days)
 * - api_key_id: UUID (filter by specific key)
 */
router.get('/analytics/usage', requireAdmin, async (req, res) => {
  try {
    const filters = {
      days: parseInt(req.query.days) || 7,
      apiKeyId: req.query.api_key_id || null
    };

    const stats = await getUsageStats(filters);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Admin] Get usage stats error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch usage statistics',
        type: 'internal_error',
        code: 'usage_stats_failed'
      }
    });
  }
});

/**
 * GET /admin/analytics/keys/:id
 * Get detailed statistics for a specific API key
 */
router.get('/analytics/keys/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await getKeyStats(id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Admin] Get key stats error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch key statistics',
        type: 'internal_error',
        code: 'key_stats_failed'
      }
    });
  }
});

// ===== Cookie Management Routes =====

/**
 * GET /admin/cookies/status
 * Get cookie file status and metadata
 */
router.get('/cookies/status', requireAdmin, async (req, res) => {
  try {
    const status = cookieService.getCookieStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[Admin] Get cookie status error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get cookie status',
        type: 'internal_error',
        code: 'cookie_status_failed'
      }
    });
  }
});

/**
 * POST /admin/cookies/upload
 * Upload new cookies file content
 * Body: { content: string } - Netscape cookie format
 */
router.post('/cookies/upload', requireAdmin, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Missing or invalid content field',
          type: 'validation_error',
          code: 'invalid_content'
        }
      });
    }

    const result = cookieService.updateCookies(content);

    res.json({
      success: true,
      data: result,
      message: 'Cookies updated successfully'
    });
  } catch (error) {
    console.error('[Admin] Upload cookies error:', error);
    res.status(400).json({
      error: {
        message: error.message || 'Failed to update cookies',
        type: 'validation_error',
        code: 'cookie_update_failed'
      }
    });
  }
});

/**
 * POST /admin/cookies/test
 * Test connection to Qwen API with current cookies or provided credentials
 * Body (optional): { cookies: string, headers: { bxUa: string, bxUmidtoken: string } }
 */
router.post('/cookies/test', requireAdmin, async (req, res) => {
  try {
    // Extract optional test credentials from request body
    const { cookies, headers } = req.body || {};

    // Test with provided credentials or fall back to saved files
    const result = await cookieService.testConnection(cookies, headers);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Admin] Test cookies error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to test connection',
        type: 'internal_error',
        code: 'cookie_test_failed'
      }
    });
  }
});

export default router;
