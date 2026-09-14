#!/usr/bin/env node

/**
 * Bootstrap script to create the first enterprise-tier admin API key
 * Run this once to create an admin key, then use the dashboard to manage keys
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function generateApiKey() {
  const randomBytes = crypto.randomBytes(24);
  return `sk-${randomBytes.toString('hex')}`;
}

async function createAdminKey() {
  console.log('🔑 Creating enterprise-tier admin API key...\n');

  const apiKey = generateApiKey();
  const name = 'Admin Dashboard';

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .insert([
        {
          key: apiKey,
          name: name,
          tier: 'enterprise',
          is_active: true,
          usage_count: 0
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating admin key:', error.message);
      process.exit(1);
    }

    console.log('✅ Enterprise admin key created successfully!\n');
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ COPY THIS KEY NOW - IT WILL NOT BE SHOWN AGAIN                 │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    console.log(`│ ${apiKey} │`);
    console.log('└─────────────────────────────────────────────────────────────────┘\n');
    console.log('📋 Key details:');
    console.log(`   Name: ${data.name}`);
    console.log(`   Tier: ${data.tier}`);
    console.log(`   Status: ${data.is_active ? 'Active' : 'Inactive'}`);
    console.log(`   Created: ${new Date(data.created_at).toLocaleString()}\n`);
    console.log('🎯 Next steps:');
    console.log('   1. Copy the key above');
    console.log('   2. Use it to login to the dashboard at http://localhost:3001');
    console.log('   3. Create additional keys through the dashboard\n');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

createAdminKey();
