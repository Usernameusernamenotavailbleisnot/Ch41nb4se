// Error handling utilities
const logger = require('./logger');

// Custom implementation of retry with exponential backoff
async function withRetry(fn, options = {}) {
  const { 
    logger: loggerInstance = logger,
    walletNum = null, 
    operationName = 'operation', 
    maxRetries = 3,
    minTimeout = 1000,
    onError = null 
  } = options;
  
  const log = walletNum !== null ? loggerInstance.getInstance(walletNum) : loggerInstance.getInstance();
  
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      log.error(`Error in ${operationName}: ${error.message}`);
      
      if (retries <= maxRetries) {
        // Calculate exponential backoff delay
        const delay = minTimeout * Math.pow(2, retries - 1);
        log.warn(`Attempt ${retries} failed. ${maxRetries - retries + 1} retries left. Waiting ${delay}ms before next attempt.`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        log.error(`All ${maxRetries} retries failed for ${operationName}: ${error.message}`);
        if (onError) return onError(error);
        return false;
      }
    }
  }
}

// Wrap methods with error handling
function wrapMethods(instance, methodNames, options = {}) {
  const defaults = {
    logger,
    walletNum: instance.walletNum,
    maxRetries: 3,
    minTimeout: 1000
  };
  
  methodNames.forEach(methodName => {
    const originalMethod = instance[methodName];
    if (typeof originalMethod !== 'function') return;
    
    instance[methodName] = async function(...args) {
      const methodOptions = {
        ...defaults,
        ...options,
        operationName: methodName
      };
      
      return withRetry(
        () => originalMethod.apply(instance, args),
        methodOptions
      );
    };
  });
  
  return instance;
}

module.exports = { 
  withRetry,
  wrapMethods
};