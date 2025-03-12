// Proxy management (Singleton)
const {HttpsProxyAgent }= require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Singleton ProxyManager class
 * Ensures only one instance of proxy management exists in the application
 */
class ProxyManager {
  constructor() {
    // Initialize with empty values - will be populated later
    this.proxies = [];
    this.config = {};
    this.walletNum = null;
    this.logger = logger.getInstance();
    this.currentProxyIndex = -1;
    this.currentProxy = null;
    this.agent = null;
    this.initialized = false;
  }

  /**
   * Initialize the proxy manager
   * @param {Object} config - Configuration object
   * @param {number|null} walletNum - Wallet number for logging
   * @returns {Promise<boolean>} Success status
   */
  async initialize(config = {}, walletNum = null) {
    if (this.initialized) {
      return true;
    }

    this.config = config;
    this.walletNum = walletNum;
    this.logger = logger.getInstance(walletNum);

    try {
      // Load proxies from file
      await this.loadProxies();

      // Check if proxy is enabled and valid
      if (this.isEnabled()) {
        if (this.proxies.length > 0) {
          this.logger.success(`Proxy support enabled with ${this.proxies.length} proxies available`);
          
          // Select initial proxy
          this.selectNextProxy();
          return true;
        } else {
          this.logger.warn('Proxy support disabled because no proxies were found in data/proxy.txt');
          
          // Disable proxy in config
          if (this.config.set) {
            this.config.set('proxy.enabled', false);
          } else if (this.config.proxy) {
            this.config.proxy.enabled = false;
          }
        }
      }

      this.initialized = true;
      return this.isEnabled();
    } catch (error) {
      this.logger.error(`Error initializing proxy manager: ${error.message}`);
      return false;
    }
  }

  /**
   * Load proxies from file
   */
  async loadProxies() {
    try {
      // Ensure data directory exists
      await fs.mkdir('data', { recursive: true });
      
      try {
        const proxyFile = await fs.readFile('data/proxy.txt', 'utf8');
        this.proxies = proxyFile.split('\n')
          .map(line => line.trim())
          .filter(line => line);
        
        if (this.proxies.length > 0) {
          this.logger.success(`Loaded ${this.proxies.length} proxies from data/proxy.txt`);
        } else {
          this.logger.warn('data/proxy.txt exists but is empty');
        }
      } catch (err) {
        // Create empty proxy file if it doesn't exist
        if (err.code === 'ENOENT') {
          this.logger.warn('data/proxy.txt not found, creating empty file');
          await fs.writeFile('data/proxy.txt', '', 'utf8');
        } else {
          throw err;
        }
      }
    } catch (error) {
      this.logger.error(`Error loading proxies: ${error.message}`);
      this.proxies = [];
    }
  }
  
  /**
   * Check if proxy support is enabled
   * @returns {boolean}
   */
  isEnabled() {
    if (this.config.get) {
      return this.config.get('proxy.enabled') === true;
    }
    return this.config.proxy && this.config.proxy.enabled === true;
  }
  
  /**
   * Get proxy type from config
   * @returns {string} http or socks5
   */
  getType() {
    if (this.config.get) {
      return this.config.get('proxy.type', 'http').toLowerCase();
    }
    return (this.config.proxy && this.config.proxy.type) ? 
           this.config.proxy.type.toLowerCase() : 'http';
  }
  
  /**
   * Select next proxy in rotation
   * @returns {string|null} Selected proxy or null if none available
   */
  selectNextProxy() {
    if (!this.isEnabled() || this.proxies.length === 0) {
      this.currentProxy = null;
      this.agent = null;
      return null;
    }
    
    // Move to next proxy in rotation
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    this.currentProxy = this.proxies[this.currentProxyIndex];
    
    this.logger.info(`Selected proxy: ${this.currentProxy}`);
    this.createAgent();
    
    return this.currentProxy;
  }
  
  /**
   * Select a random proxy
   * @returns {string|null} Selected proxy or null if none available
   */
  selectRandomProxy() {
    if (!this.isEnabled() || this.proxies.length === 0) {
      this.currentProxy = null;
      this.agent = null;
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * this.proxies.length);
    this.currentProxyIndex = randomIndex;
    this.currentProxy = this.proxies[randomIndex];
    
    this.logger.info(`Selected random proxy: ${this.currentProxy}`);
    this.createAgent();
    
    return this.currentProxy;
  }
  
  /**
   * Create proxy agent based on proxy type
   */
  createAgent() {
    if (!this.currentProxy) return;
    
    try {
      const proxyType = this.getType();
      
      if (proxyType === 'socks5') {
        const socksUrl = this.currentProxy.startsWith('socks5://') ? 
                         this.currentProxy : `socks5://${this.currentProxy}`;
        this.agent = new SocksProxyAgent(socksUrl);
        this.logger.info(`Created SOCKS5 proxy agent for ${this.currentProxy}`);
      } else {
        const httpUrl = this.currentProxy.startsWith('http://') || this.currentProxy.startsWith('https://') ? 
                       this.currentProxy : `http://${this.currentProxy}`;
        this.agent = new HttpsProxyAgent(httpUrl);
        this.logger.info(`Created HTTP proxy agent for ${this.currentProxy}`);
      }
    } catch (error) {
      this.logger.error(`Error creating proxy agent: ${error.message}`);
      this.agent = null;
    }
  }
  
  /**
   * Get HTTP(S) proxy agent
   * @returns {Object|null} Proxy agent
   */
  getAgent() {
    return this.isEnabled() ? this.agent : null;
  }
  
  /**
   * Get proxy headers for authentication
   * @returns {Object} Headers
   */
  getHeaders() {
    if (!this.isEnabled() || !this.currentProxy) {
      return {};
    }
    
    // Check if the proxy has auth (user:pass format)
    const match = this.currentProxy.match(/(.*):(.*)@(.*)/);
    if (match) {
      const [_, username, password] = match;
      return {
        'Proxy-Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      };
    }
    
    return {};
  }
  
  /**
   * Get axios configuration for proxy
   * @returns {Object} Axios config
   */
  getAxiosConfig() {
    if (!this.isEnabled() || !this.agent) {
      return {};
    }
    
    return {
      httpsAgent: this.agent,
      proxy: false // Important: set to false when using agent directly
    };
  }
  
  /**
   * Update wallet number and logger
   * @param {number} walletNum Wallet number
   */
  setWalletNum(walletNum) {
    this.walletNum = walletNum;
    this.logger = logger.getInstance(walletNum);
  }
}

// Create singleton instance
const instance = new ProxyManager();

// Export single instance
module.exports = instance;