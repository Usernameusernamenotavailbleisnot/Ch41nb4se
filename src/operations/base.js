// Base class for all blockchain operations
const Blockchain = require('../core/blockchain');
const config = require('../core/config');
const logger = require('../utils/logger');
const proxyManager = require('../core/proxy');
const { randomDelay } = require('../utils/delay');

class BaseOperation {
  constructor(blockchainOrPrivateKey, configObj = {}, operationName = null) {
    this.operationName = operationName;
    this.defaultConfig = {};
    
    // Initialize blockchain manager from instance or create new one
    if (blockchainOrPrivateKey && typeof blockchainOrPrivateKey === 'object' && blockchainOrPrivateKey.constructor.name === 'Blockchain') {
      this.blockchain = blockchainOrPrivateKey;
    } else if (blockchainOrPrivateKey && typeof blockchainOrPrivateKey === 'string') {
      this.blockchain = new Blockchain(blockchainOrPrivateKey, configObj, null);
    } else {
      this.blockchain = null;
    }
    
    this.walletNum = this.blockchain ? this.blockchain.walletNum : null;
    
    // Set configuration
    this.config = configObj;
    
    // Use shared logger instance
    this.logger = this.walletNum !== null ? logger.getInstance(this.walletNum) : logger.getInstance();
  }
  
  setWalletNum(num) {
    this.walletNum = num;
    if (this.blockchain) this.blockchain.setWalletNum(num);
    this.logger = logger.getInstance(num);
  }
  
  isEnabled() {
    if (!this.operationName) return true;
    
    return this.config.isEnabled ? 
      this.config.isEnabled(this.operationName) : 
      this.config.get(`operations.${this.operationName}.enabled`, false) === true;
  }
  
  getDelayConfig() {
    return this.config.getDelayConfig ? 
      this.config.getDelayConfig() : 
      (this.config.general && this.config.general.delay) || 
      { min_seconds: 5, max_seconds: 30 };
  }
  
  async addDelay(message) {
    return await randomDelay(this.getDelayConfig(), this.walletNum, message);
  }
  
  async execute() {
    if (!this.isEnabled()) {
      this.logger.warn(`${this.operationName} operations disabled in config`);
      return true; // Return success to not interrupt the flow
    }
    
    this.logger.header(`Starting ${this.operationName} operations...`);
    
    try {
      // Reset blockchain manager nonce if available
      if (this.blockchain) this.blockchain.resetNonce();
      
      // Log proxy status if enabled
      if (proxyManager.isEnabled()) {
        if (proxyManager.currentProxy) {
          this.logger.info(`Using proxy for ${this.operationName} operations: ${proxyManager.currentProxy}`);
        } else {
          this.logger.warn(`Proxy support enabled for ${this.operationName} but no proxy selected`);
        }
      }
      
      // Execute implementation-specific operations
      const result = await this.executeOperations();
      
      if (result) {
        this.logger.success(`${this.operationName} operations completed successfully!`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error in ${this.operationName} operations: ${error.message}`);
      
      // Try changing proxy if proxy-related error
      if (proxyManager.isEnabled() &&
          (error.message.includes('proxy') || error.message.includes('ETIMEDOUT') || 
           error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET'))) {
        
        this.logger.warn('Proxy error detected, trying to change proxy...');
        if (this.blockchain) this.blockchain.changeProxy();
      }
      
      return false;
    }
  }
  
  async executeOperations() {
    throw new Error('executeOperations must be implemented by subclass');
  }
}

module.exports = BaseOperation;