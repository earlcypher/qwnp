import supabase from '../supabaseClient.js';

/**
 * Analytics Service
 * Fetches request logs and statistics from Supabase
 */

/**
 * Get recent request logs with optional filters
 */
export async function getRequestLogs(filters = {}) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const {
    limit = 100,
    offset = 0,
    apiKeyId = null,
    statusCode = null,
    startDate = null,
    endDate = null
  } = filters;

  try {
    let query = supabase
      .from('request_logs')
      .select(`
        *,
        api_keys (
          id,
          name,
          tier
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (apiKeyId) {
      query = query.eq('api_key_id', apiKeyId);
    }

    if (statusCode) {
      query = query.eq('status_code', statusCode);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      logs: data || [],
      total: count || data?.length || 0
    };
  } catch (error) {
    console.error('[Analytics] Error fetching logs:', error);
    throw error;
  }
}

/**
 * Get aggregated usage statistics
 */
export async function getUsageStats(filters = {}) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const {
    days = 7,
    apiKeyId = null
  } = filters;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily request counts
    let query = supabase
      .from('request_logs')
      .select('created_at, status_code, api_key_id')
      .gte('created_at', startDate.toISOString());

    if (apiKeyId) {
      query = query.eq('api_key_id', apiKeyId);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    // Aggregate data
    const stats = {
      total_requests: logs.length,
      success_count: logs.filter(l => l.status_code >= 200 && l.status_code < 300).length,
      error_count: logs.filter(l => l.status_code >= 400).length,
      requests_by_day: aggregateByDay(logs),
      requests_by_status: aggregateByStatus(logs),
      top_keys: await getTopKeys(logs)
    };

    return stats;
  } catch (error) {
    console.error('[Analytics] Error fetching stats:', error);
    throw error;
  }
}

/**
 * Aggregate logs by day
 */
function aggregateByDay(logs) {
  const byDay = {};

  logs.forEach(log => {
    const date = log.created_at.split('T')[0]; // Get YYYY-MM-DD
    if (!byDay[date]) {
      byDay[date] = {
        date,
        total: 0,
        success: 0,
        errors: 0
      };
    }

    byDay[date].total++;
    if (log.status_code >= 200 && log.status_code < 300) {
      byDay[date].success++;
    }
    if (log.status_code >= 400) {
      byDay[date].errors++;
    }
  });

  // Convert to array and sort by date
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregate logs by status code
 */
function aggregateByStatus(logs) {
  const byStatus = {};

  logs.forEach(log => {
    const status = log.status_code;
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  return byStatus;
}

/**
 * Get top API keys by usage
 */
async function getTopKeys(logs) {
  const keyUsage = {};

  logs.forEach(log => {
    if (log.api_key_id) {
      keyUsage[log.api_key_id] = (keyUsage[log.api_key_id] || 0) + 1;
    }
  });

  // Sort by usage and get top 5
  const topKeyIds = Object.entries(keyUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyId, count]) => ({ keyId, count }));

  // Fetch key details
  if (topKeyIds.length === 0) return [];

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, tier')
    .in('id', topKeyIds.map(k => k.keyId));

  return topKeyIds.map(({ keyId, count }) => {
    const key = keys?.find(k => k.id === keyId);
    return {
      id: keyId,
      name: key?.name || 'Unknown',
      tier: key?.tier || 'unknown',
      request_count: count
    };
  });
}

/**
 * Get statistics for a specific API key
 */
export async function getKeyStats(apiKeyId) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: logs, error } = await supabase
      .from('request_logs')
      .select('*')
      .eq('api_key_id', apiKeyId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (error) throw error;

    const stats = {
      total_requests: logs.length,
      success_count: logs.filter(l => l.status_code >= 200 && l.status_code < 300).length,
      error_count: logs.filter(l => l.status_code >= 400).length,
      avg_response_time: Math.round(
        logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / (logs.length || 1)
      ),
      last_used: logs.length > 0 ? logs[0].created_at : null,
      requests_by_day: aggregateByDay(logs)
    };

    return stats;
  } catch (error) {
    console.error('[Analytics] Error fetching key stats:', error);
    throw error;
  }
}
