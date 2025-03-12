// ERC20 token operations
const { ethers } = require('ethers');
const constants = require('../utils/constants');
const BaseOperation = require('./base');
const Contract = require('../core/contract');

class ERC20 extends BaseOperation {
  constructor(privateKey, configObj = {}) {
    // Default configuration
    const defaultConfig = {
      enabled: true,
      mint_amount: {
        min: 1000000,
        max: 10000000
      },
      burn_percentage: 10,
      decimals: 18
    };
    
    // Initialize base class
    super(privateKey, configObj, 'erc20');
    
    // Set default config
    this.defaultConfig = defaultConfig;
    
    // Initialize contract manager
    this.contractManager = new Contract(this.blockchain, configObj);
  }
  
  generateRandomTokenName() {
    const prefix = constants.ERC20.TOKEN_NAME_PREFIXES[Math.floor(Math.random() * constants.ERC20.TOKEN_NAME_PREFIXES.length)];
    const suffix = constants.ERC20.TOKEN_NAME_SUFFIXES[Math.floor(Math.random() * constants.ERC20.TOKEN_NAME_SUFFIXES.length)];
    return `${prefix} ${suffix}`;
  }
  
  generateTokenSymbol(name) {
    // Create symbol from first letters of each word
    const symbol = name.split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('');
      
    // If too long, use abbreviation
    if (symbol.length > 5) {
      return name.split(' ')[0].substring(0, 4).toUpperCase();
    }
    
    return symbol;
  }
  
  formatTokenAmount(amount, decimals) {
    return ethers.parseUnits(amount.toString(), decimals);
  }
  
  async executeOperations() {
    try {
      // Generate token name and symbol
      const tokenName = this.generateRandomTokenName();
      const symbol = this.generateTokenSymbol(tokenName);
      const decimals = this.config.get ? 
        this.config.getNumber('operations.erc20.decimals', 18) :
        (this.config.operations?.erc20?.decimals || 18);
      
      this.logger.info(`Token: ${tokenName} (${symbol})`);
      this.logger.info(`Decimals: ${decimals}`);
      
      // Format contract name for Solidity
      const solContractName = tokenName.replace(/[^a-zA-Z0-9]/g, '');
      
      // Compile token contract
      const contractSource = constants.ERC20.CONTRACT_TEMPLATE.replace(/{{CONTRACT_NAME}}/g, solContractName);
      const compiledContract = await this.contractManager.compileContract(solContractName, contractSource);
      
      // Add random delay before deployment
      await this.addDelay("ERC20 contract deployment");
      
      // Deploy token contract
      const deployedContract = await this.contractManager.deployContract(
        compiledContract, 
        [tokenName, symbol, decimals],
        "ERC20 token"
      );
      
      // Determine mint amount
      const mintAmount = this.config.get ? 
        this.config.getRandomInRange('erc20', 'mint_amount', 1000000, 10000000) :
        Math.floor(Math.random() * 9000000) + 1000000;
      
      this.logger.info(`Will mint ${mintAmount.toLocaleString()} tokens...`);
      
      // Add random delay before minting
      //await this.addDelay("token minting");
      
      // Format amount with decimals
      const formattedAmount = this.formatTokenAmount(mintAmount, decimals);
      
      // Mint tokens
      const mintResult = await this.contractManager.callContractMethod(
        deployedContract.contractAddress,
        deployedContract.abi,
        'mint',
        [this.blockchain.address, formattedAmount]
      );
      
      if (mintResult.success) {
        this.logger.success(`Minted ${mintAmount.toLocaleString()} ${symbol} tokens`);
        
        // Determine burn amount based on config percentage
        const burnPercentage = this.config.get ? 
          this.config.getNumber('operations.erc20.burn_percentage', 10) :
          (this.config.operations?.erc20?.burn_percentage || 10);
                              
        const burnAmount = Math.floor(mintAmount * burnPercentage / 100);
        
        if (burnAmount > 0) {
          await this.burnTokens(deployedContract, burnAmount, burnPercentage, symbol, decimals);
        } else {
          this.logger.info(`No tokens to burn (burn percentage: ${burnPercentage}%)`);
        }
      } else {
        this.logger.error(`Failed to mint tokens: ${mintResult.error}`);
      }
      
      this.logger.success(`ERC20 token operations completed!`);
      this.logger.success(`Contract address: ${deployedContract.contractAddress}`);
      this.logger.success(`Token: ${tokenName} (${symbol})`);
      this.logger.success(`View contract: ${constants.NETWORK.EXPLORER_URL}/address/${deployedContract.contractAddress}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error executing ERC20 token operations: ${error.message}`);
      return false;
    }
  }
  
  async burnTokens(deployedContract, burnAmount, burnPercentage, symbol, decimals) {
    try {
      this.logger.info(`Burning ${burnAmount.toLocaleString()} tokens (${burnPercentage}% of minted)...`);
      
      // Add random delay before burning
      //await this.addDelay("token burning");
      
      // Format burn amount with decimals
      const formattedBurnAmount = this.formatTokenAmount(burnAmount, decimals);
      
      // Burn tokens
      const burnResult = await this.contractManager.callContractMethod(
        deployedContract.contractAddress,
        deployedContract.abi,
        'burn',
        [formattedBurnAmount]
      );
      
      if (burnResult.success) {
        this.logger.success(`Burned ${burnAmount.toLocaleString()} ${symbol} tokens`);
        return true;
      } else {
        this.logger.error(`Failed to burn tokens: ${burnResult.error}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error burning tokens: ${error.message}`);
      return false;
    }
  }
}

module.exports = ERC20;