// Delay utilities for rate limiting and operation pacing
const chalk = require('chalk');
const logger = require('./logger');

// Add a random delay between operations
async function randomDelay(config, walletNum, operationName = 'next transaction') {
  try {
    // Get logger instance
    const log = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
    
    // Extract delay settings
    const delayConfig = extractDelayConfig(config);
    
    // Generate random delay
    const delay = generateDelay(delayConfig.minDelay, delayConfig.maxDelay);
    
    log.custom(`⌛ Waiting ${delay} seconds before ${operationName}...`, chalk.yellow);
    await wait(delay * 1000);
    
    return true;
  } catch (error) {
    const log = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
    log.error(`Error in delay function: ${error.message}`);
    return false;
  }
}

// Extract delay configuration from various formats
function extractDelayConfig(config) {
  let minDelay, maxDelay;
  
  if (config.min_seconds !== undefined && config.max_seconds !== undefined) {
    // Direct delay object
    minDelay = config.min_seconds;
    maxDelay = config.max_seconds;
  } else if (config.delay && config.delay.min_seconds !== undefined && config.delay.max_seconds !== undefined) {
    // Config with delay property
    minDelay = config.delay.min_seconds;
    maxDelay = config.delay.max_seconds;
  } else if (config.general && config.general.delay) {
    // Config with general.delay property
    minDelay = config.general.delay.min_seconds;
    maxDelay = config.general.delay.max_seconds;
  } else if (config.get) {
    // Config manager instance
    const delayConfig = config.getDelayConfig();
    minDelay = delayConfig.min_seconds;
    maxDelay = delayConfig.max_seconds;
  } else {
    // Default fallback
    minDelay = 5;
    maxDelay = 30;
  }
  
  return { minDelay, maxDelay };
}

// Generate a random delay within a range
function generateDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Promise-based wait function
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exponential backoff for retries
async function exponentialBackoff(baseDelay = 1000, retryCount = 0, maxDelay = 60000) {
  const delay = Math.min(
    Math.floor(baseDelay * Math.pow(1.5, retryCount) + Math.random() * 1000),
    maxDelay
  );
  
  await wait(delay);
  return delay;
}

module.exports = {
  randomDelay,
  wait,
  exponentialBackoff
};