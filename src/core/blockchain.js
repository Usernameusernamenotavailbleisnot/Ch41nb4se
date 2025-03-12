// Blockchain interactions manager
const { ethers } = require('ethers');
const constants = require('../utils/constants');
const logger = require('../utils/logger');
const proxyManager = require('./proxy');

class Blockchain {
  constructor(privateKey, config = {}, walletNum = null) {
    // Store configuration
    this.config = config;
    this.walletNum = walletNum;
    this.logger = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
    
    // Initialize providers
    this.rpcUrl = constants.NETWORK.RPC_URL;
    this.provider = this.createProvider(this.rpcUrl);
    this.sepoliaProvider = this.createProvider(constants.SEPOLIA.RPC_URL);
    
    // Setup wallet
    if (privateKey) {
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.sepoliaWallet = new ethers.Wallet(privateKey, this.sepoliaProvider);
      this.address = this.wallet.address;
      this.privateKey = privateKey;
    }
    
    // Track nonce values
    this.currentNonce = null;
    this.sepoliaNonce = null;
    
    // Log proxy status
    if (proxyManager.isEnabled() && proxyManager.currentProxy) {
      this.logger.info(`Using proxy for blockchain connections: ${proxyManager.currentProxy}`);
    }
  }
  
  createProvider(rpcUrl) {
    // Create JSON-RPC fetch function with proxy setup
    let fetchFn = undefined;
    const proxyHeaders = proxyManager.getHeaders();
    
    if (Object.keys(proxyHeaders).length > 0) {
      // Create a custom fetch function that adds proxy headers
      fetchFn = async (url, json) => {
        const response = await fetch(url, {
          method: 'POST',
          body: json,
          headers: {
            'Content-Type': 'application/json',
            ...proxyHeaders
          }
        });
        return response;
      };
    }
    
    // Create provider with custom fetch function if available
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { fetchFunc: fetchFn });
    return provider;
  }
  
  setWalletNum(num) {
    this.walletNum = num;
    this.logger = logger.getInstance(num);
  }
  
  changeProxy() {
    const newProxy = proxyManager.selectNextProxy();
    
    if (newProxy) {
      // Re-initialize providers
      this.provider = this.createProvider(this.rpcUrl);
      this.sepoliaProvider = this.createProvider(constants.SEPOLIA.RPC_URL);
      
      // Reinitialize wallets
      if (this.privateKey) {
        this.wallet = new ethers.Wallet(this.privateKey, this.provider);
        this.sepoliaWallet = new ethers.Wallet(this.privateKey, this.sepoliaProvider);
        this.address = this.wallet.address;
      }
      
      this.logger.info(`Changed proxy to: ${newProxy}`);
    }
    
    return newProxy;
  }
  
  async getNonce(network = 'chainbase') {
    if (network === 'sepolia') {
      if (this.sepoliaNonce === null) {
        this.sepoliaNonce = await this.sepoliaProvider.getTransactionCount(this.address);
        this.logger.info(`Initial Sepolia nonce from network: ${this.sepoliaNonce}`);
      } else {
        this.logger.info(`Using tracked Sepolia nonce: ${this.sepoliaNonce}`);
      }
      return this.sepoliaNonce;
    } else {
      if (this.currentNonce === null) {
        this.currentNonce = await this.provider.getTransactionCount(this.address);
        this.logger.info(`Initial Chainbase nonce from network: ${this.currentNonce}`);
      } else {
        this.logger.info(`Using tracked Chainbase nonce: ${this.currentNonce}`);
      }
      return this.currentNonce;
    }
  }
  
  incrementNonce(network = 'chainbase') {
    if (network === 'sepolia') {
      if (this.sepoliaNonce !== null) {
        this.sepoliaNonce++;
        this.logger.info(`Incremented Sepolia nonce to: ${this.sepoliaNonce}`);
      }
    } else {
      if (this.currentNonce !== null) {
        this.currentNonce++;
        this.logger.info(`Incremented Chainbase nonce to: ${this.currentNonce}`);
      }
    }
  }
  
  async getGasPrice(retryCount = 0, network = 'chainbase') {
    try {
      const provider = network === 'sepolia' ? this.sepoliaProvider : this.provider;
      const networkName = network === 'sepolia' ? 'Sepolia' : 'Chainbase';
      
      // Get current gas price
      const feeData = await provider.getFeeData();
      const networkGasPrice = feeData.gasPrice;
      
      // Apply multiplier
      let multiplier = (this.config.get && this.config.get('general.gas_price_multiplier')) || constants.GAS.PRICE_MULTIPLIER;
      
      // Apply retry multiplier
      if (retryCount > 0) {
        const retryMultiplier = Math.pow(constants.GAS.RETRY_INCREASE, retryCount);
        multiplier *= retryMultiplier;
        this.logger.info(`Applying retry multiplier: ${retryMultiplier.toFixed(2)}x (total: ${multiplier.toFixed(2)}x)`);
      }
      
      // Calculate adjusted gas price
      const adjustedGasPrice = BigInt(Math.floor(Number(networkGasPrice) * multiplier));
      
      // Convert to gwei for display
      const gweiPrice = ethers.formatUnits(adjustedGasPrice, 'gwei');
      this.logger.info(`${networkName} gas price: ${ethers.formatUnits(networkGasPrice, 'gwei')} gwei, using: ${gweiPrice} gwei (${multiplier.toFixed(2)}x)`);
      
      // Enforce min/max gas price
      const minGasPrice = BigInt(ethers.parseUnits(constants.GAS.MIN_GWEI.toString(), 'gwei'));
      const maxGasPrice = BigInt(ethers.parseUnits(constants.GAS.MAX_GWEI.toString(), 'gwei'));
      
      let finalGasPrice = adjustedGasPrice;
      if (adjustedGasPrice < minGasPrice) {
        finalGasPrice = minGasPrice;
        this.logger.warn(`Gas price below minimum, using: ${constants.GAS.MIN_GWEI} gwei`);
      } else if (adjustedGasPrice > maxGasPrice) {
        finalGasPrice = maxGasPrice;
        this.logger.warn(`Gas price above maximum, using: ${constants.GAS.MAX_GWEI} gwei`);
      }
      
      return finalGasPrice;
    } catch (error) {
      this.logger.warn(`Error getting gas price: ${error.message}`);
      
      // Handle proxy errors
      if (proxyManager.isEnabled() && error.message.includes('proxy')) {
        this.logger.warn('Proxy error detected, trying to change proxy...');
        this.changeProxy();
        if (retryCount < 3) {
          return this.getGasPrice(retryCount + 1, network);
        }
      }
      
      // Fallback to minimum gas price
      const fallbackGasPrice = ethers.parseUnits(constants.GAS.MIN_GWEI.toString(), 'gwei');
      this.logger.warn(`Using fallback gas price: ${constants.GAS.MIN_GWEI} gwei`);
      
      return fallbackGasPrice;
    }
  }
  
  async estimateGas(txObject, network = 'chainbase') {
    try {
      const provider = network === 'sepolia' ? this.sepoliaProvider : this.provider;
      
      // Estimate gas
      const estimatedGas = await provider.estimateGas(txObject);
      
      // Add safety buffer
      const gasWithBuffer = BigInt(Math.floor(Number(estimatedGas) * 1.2));
      
      this.logger.info(`Estimated gas: ${estimatedGas.toString()}, with buffer: ${gasWithBuffer.toString()}`);
      
      return gasWithBuffer;
    } catch (error) {
      this.logger.warn(`Gas estimation failed: ${error.message}`);
      
      // Handle proxy errors
      if (proxyManager.isEnabled() && error.message.includes('proxy')) {
        this.logger.warn('Proxy error detected, trying to change proxy...');
        this.changeProxy();
        if (txObject.retry === undefined || txObject.retry < 3) {
          const newTxObject = { ...txObject, retry: (txObject.retry || 0) + 1 };
          return this.estimateGas(newTxObject, network);
        }
      }
      
      // Use default gas limit
      const defaultGas = constants.GAS.DEFAULT_GAS;
      this.logger.warn(`Using default gas: ${defaultGas}`);
      return BigInt(defaultGas);
    }
  }
  
  async sendTransaction(txObject, methodName = "transaction", network = 'chainbase') {
    try {
      const wallet = network === 'sepolia' ? this.sepoliaWallet : this.wallet;
      const chainId = network === 'sepolia' ? constants.SEPOLIA.CHAIN_ID : constants.NETWORK.CHAIN_ID;
      const explorerUrl = network === 'sepolia' ? constants.SEPOLIA.EXPLORER_URL : constants.NETWORK.EXPLORER_URL;
      
      // Get nonce and gas price
      const nonce = await this.getNonce(network);
      const gasPrice = await this.getGasPrice(0, network);
      
      // Create transaction template
      const txTemplate = {
        from: this.address,
        ...txObject,
        nonce: nonce,
        chainId: chainId
      };
      
      // Estimate gas if not provided
      if (!txTemplate.gasLimit) {
        txTemplate.gasLimit = await this.estimateGas(txTemplate, network);
      }
      
      // Set gas price if not provided
      if (!txTemplate.gasPrice) {
        txTemplate.gasPrice = gasPrice;
      }
      
      // Increment nonce before sending
      this.incrementNonce(network);
      
      // Send transaction
      const tx = await wallet.sendTransaction(txTemplate);
      const receipt = await tx.wait();
      
      this.logger.success(`${methodName} transaction successful`);
      
      return {
        txHash: receipt.hash,
        receipt,
        success: true
      };
    } catch (error) {
      // Extract clean error message
      let cleanErrorMessage = '';
      
      if (error.code) {
        // Use error code if available
        cleanErrorMessage = error.code;
        
        // Add specific details for common errors
        if (error.code === 'INSUFFICIENT_FUNDS') {
          cleanErrorMessage = 'Insufficient funds for transaction';
        } else if (error.code === 'NONCE_EXPIRED') {
          cleanErrorMessage = 'Nonce has already been used';
        } else if (error.code === 'REPLACEMENT_UNDERPRICED') {
          cleanErrorMessage = 'Gas price too low to replace pending transaction';
        } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
          cleanErrorMessage = 'Cannot estimate gas for transaction';
        } else {
          // Add additional error information when helpful
          if (error.reason) {
            cleanErrorMessage += `: ${error.reason}`;
          }
        }
      } else {
        // Use message if no code is available
        cleanErrorMessage = error.message;
        
        // Try to extract the most relevant part
        if (error.message.includes(':')) {
          cleanErrorMessage = error.message.split(':')[0].trim();
        }
      }
      
      this.logger.error(`Error in ${methodName}: ${cleanErrorMessage}`);
      
      // Handle proxy errors
      if (proxyManager.isEnabled() &&
          (error.message.includes('proxy') || error.message.includes('ETIMEDOUT') || 
          error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET'))) {
        
        this.logger.warn('Possible proxy error detected, trying to change proxy...');
        this.changeProxy();
        
        // Retry with new proxy
        if (txObject.retryCount === undefined || txObject.retryCount < 3) {
          this.logger.info(`Retrying transaction with new proxy (attempt ${(txObject.retryCount || 0) + 1}/3)...`);
          const newTxObject = { ...txObject, retryCount: (txObject.retryCount || 0) + 1 };
          return this.sendTransaction(newTxObject, methodName, network);
        }
      }
      
      return {
        success: false,
        error: cleanErrorMessage,
        code: error.code || 'UNKNOWN_ERROR',
        details: error
      };
    }
  }
  
  async getBalance(network = 'chainbase') {
    try {
      const provider = network === 'sepolia' ? this.sepoliaProvider : this.provider;
      const currency = "ETH";
      
      const balance = await provider.getBalance(this.address);
      const balanceInEth = ethers.formatEther(balance);
      
      this.logger.info(`${network.charAt(0).toUpperCase() + network.slice(1)} Balance: ${balanceInEth} ${currency}`);
      
      return { 
        balance, 
        balanceInEth,
        currency
      };
    } catch (error) {
      this.logger.error(`Error getting balance: ${error.message}`);
      
      // Handle proxy errors
      if (proxyManager.isEnabled() && 
          (error.message.includes('proxy') || error.message.includes('ETIMEDOUT') || 
           error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET'))) {
        
        this.logger.warn('Proxy error detected, trying to change proxy...');
        if (this.changeProxy()) {
          this.logger.info('Retrying getBalance with new proxy...');
          return this.getBalance(network);
        }
      }
      
      return {
        balance: '0',
        balanceInEth: '0',
        currency: "ETH",
        error: error.message
      };
    }
  }
  
  resetNonce(network = 'chainbase') {
    if (network === 'sepolia') {
      this.sepoliaNonce = null;
    } else {
      this.currentNonce = null;
    }
  }
  
  getProxyInfo() {
    if (!proxyManager.isEnabled()) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      current: proxyManager.currentProxy,
      type: proxyManager.getType()
    };
  }
}

module.exports = Blockchain;