import supabase from '../supabaseClient.js';

/**
 * Request Logging Middleware
 * Logs all API requests to Supabase for analytics
 */

/**
 * Middleware to track request start time and log after response
 */
export function requestLogger(req, res, next) {
  // Skip logging for health checks and non-API routes
  const skipPaths = ['/health', '/health/credentials'];
  if (skipPaths.includes(req.path)) {
    return next();
  }

  // Capture start time
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override res.end to log after response is sent
  res.end = function (...args) {
    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Log the request (non-blocking)
    logRequest(req, res, responseTime).catch(err => {
      console.error('[Logger] Failed to log request:', err.message);
    });

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Log request to Supabase
 */
async function logRequest(req, res, responseTime) {
  // Skip if Supabase is not configured
  if (!supabase) {
    return;
  }

  try {
    const logEntry = {
      api_key_id: req.apiKey?.id || null,
      endpoint: req.path,
      method: req.method,
      status_code: res.statusCode,
      response_time_ms: responseTime,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.headers['user-agent'] || null,
      created_at: new Date().toISOString()
    };

    // Add error details if request failed
    if (res.statusCode >= 400) {
      logEntry.error_type = getErrorType(res.statusCode);
      logEntry.error_message = res.statusMessage || 'Request failed';
    }

    // Insert into Supabase
    const { error } = await supabase
      .from('request_logs')
      .insert([logEntry]);

    if (error) {
      console.error('[Logger] Supabase insert failed:', error.message);
    }
  } catch (error) {
    console.error('[Logger] Error logging request:', error.message);
  }
}

/**
 * Get error type from status code
 */
function getErrorType(statusCode) {
  if (statusCode >= 400 && statusCode < 500) {
    if (statusCode === 401) return 'authentication_error';
    if (statusCode === 403) return 'authorization_error';
    if (statusCode === 404) return 'not_found';
    if (statusCode === 429) return 'rate_limit_error';
    return 'client_error';
  }
  if (statusCode >= 500) {
    return 'server_error';
  }
  return 'unknown_error';
}

/**
 * Update API key usage stats
 * Called after logging to keep usage_count in sync
 */
export async function updateKeyUsageStats(apiKeyId) {
  if (!supabase || !apiKeyId) return;

  try {
    // Increment usage_count and update last_used_at
    const { error } = await supabase
      .from('api_keys')
      .update({
        usage_count: supabase.raw('usage_count + 1'),
        last_used_at: new Date().toISOString()
      })
      .eq('id', apiKeyId);

    if (error) {
      console.error('[Logger] Failed to update key stats:', error.message);
    }
  } catch (error) {
    console.error('[Logger] Error updating key stats:', error.message);
  }
}
