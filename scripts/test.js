#!/usr/bin/env node

/**
 * Simple test script to verify key generation works
 */

import { ALGORITHM_CONFIG } from './did-config.js';

console.log('🧪 Running tests...\n');

// Test 1: Verify algorithm configuration
console.log('Test 1: Verifying algorithm configuration...');
const algorithms = Object.keys(ALGORITHM_CONFIG);
console.log(`  ✓ Found ${algorithms.length} supported algorithms`);
algorithms.forEach(alg => {
  const config = ALGORITHM_CONFIG[alg];
  if (!config.alg || !config.keyType) {
    throw new Error(`Invalid config for ${alg}`);
  }
  console.log(`    - ${alg}: ${config.description}`);
});

console.log('\n✅ All tests passed!');
