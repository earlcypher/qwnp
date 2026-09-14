import crypto from 'crypto';
import supabase from '../supabaseClient.js';

/**
 * API Key Service
 * Handles all API key operations with Supabase
 */

/**
 * Generate a secure API key
 * Format: sk-{32 random hex characters}
 */
export function generateApiKey() {
  const randomBytes = crypto.randomBytes(24);
  return `sk-${randomBytes.toString('hex')}`;
}

/**
 * Create a new API key
 * @param {Object} params - Key parameters
 * @param {string} params.name - Friendly name for the key
 * @param {string} params.tier - Tier: 'free', 'premium', or 'enterprise'
 * @returns {Object} Created API key object
 */
export async function createApiKey({ name, tier = 'free' }) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const key = generateApiKey();

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      key,
      name,
      tier,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.error('[API Key Service] Create error:', error);
    throw new Error(`Failed to create API key: ${error.message}`);
  }

  console.log(`[API Key Service] Created key: ${data.id} (${name}, ${tier})`);
  return data;
}

/**
 * Get API key by key string
 * @param {string} key - The API key string
 * @returns {Object|null} API key object or null if not found
 */
export async function getApiKey(key) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('[API Key Service] Get error:', error);
    throw new Error(`Failed to get API key: ${error.message}`);
  }

  return data || null;
}

/**
 * List all API keys
 * @param {Object} options - Query options
 * @param {boolean} options.activeOnly - Only return active keys
 * @returns {Array} Array of API key objects
 */
export async function listApiKeys({ activeOnly = false } = {}) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  let query = supabase
    .from('api_keys')
    .select('id, name, tier, is_active, created_at, last_used_at, usage_count')
    .order('created_at', { ascending: false });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[API Key Service] List error:', error);
    throw new Error(`Failed to list API keys: ${error.message}`);
  }

  return data || [];
}

/**
 * Update API key
 * @param {string} keyId - UUID of the key
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated API key object
 */
export async function updateApiKey(keyId, updates) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Don't allow updating the key itself or id
  const allowedUpdates = {};
  if (updates.name !== undefined) allowedUpdates.name = updates.name;
  if (updates.tier !== undefined) allowedUpdates.tier = updates.tier;
  if (updates.is_active !== undefined) allowedUpdates.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('api_keys')
    .update(allowedUpdates)
    .eq('id', keyId)
    .select()
    .single();

  if (error) {
    console.error('[API Key Service] Update error:', error);
    throw new Error(`Failed to update API key: ${error.message}`);
  }

  console.log(`[API Key Service] Updated key: ${keyId}`);
  return data;
}

/**
 * Delete (deactivate) API key
 * @param {string} keyId - UUID of the key
 * @returns {Object} Deleted API key object
 */
export async function deleteApiKey(keyId) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Soft delete by setting is_active to false
  const { data, error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .select()
    .single();

  if (error) {
    console.error('[API Key Service] Delete error:', error);
    throw new Error(`Failed to delete API key: ${error.message}`);
  }

  console.log(`[API Key Service] Deleted (deactivated) key: ${keyId}`);
  return data;
}

/**
 * Validate API key
 * @param {string} key - The API key string
 * @returns {Object|null} API key object if valid and active, null otherwise
 */
export async function validateApiKey(key) {
  if (!supabase) {
    // If Supabase not configured, authentication is disabled
    return null;
  }

  if (!key || !key.startsWith('sk-')) {
    return null;
  }

  const apiKey = await getApiKey(key);

  if (!apiKey || !apiKey.is_active) {
    return null;
  }

  return apiKey;
}

/**
 * Update usage statistics for an API key
 * Uses atomic database function to prevent race conditions
 * @param {string} keyId - UUID of the key
 */
export async function updateUsageStats(keyId) {
  if (!supabase) {
    return;
  }

  try {
    // Use atomic increment function to avoid race conditions
    const { error } = await supabase.rpc('increment_api_key_usage', {
      key_id: keyId
    });

    if (error) {
      console.error('[API Key Service] Update usage error:', error);
    }
  } catch (error) {
    console.error('[API Key Service] Update usage stats error:', error);
    // Don't throw - usage tracking is non-critical
  }
}

/**
 * Get usage statistics
 * @returns {Object} Usage stats across all keys
 */
export async function getUsageStats() {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('tier, is_active, usage_count');

  if (error) {
    console.error('[API Key Service] Stats error:', error);
    throw new Error(`Failed to get usage stats: ${error.message}`);
  }

  // Aggregate stats
  const stats = {
    total_keys: data.length,
    active_keys: data.filter(k => k.is_active).length,
    total_requests: data.reduce((sum, k) => sum + (k.usage_count || 0), 0),
    by_tier: {
      free: data.filter(k => k.tier === 'free').length,
      premium: data.filter(k => k.tier === 'premium').length,
      enterprise: data.filter(k => k.tier === 'enterprise').length
    }
  };

  return stats;
}
