// Application entry point
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const logger = require('./src/utils/logger');
const banner = require('./src/utils/banner');
const error = require('./src/utils/error');
const config = require('./src/core/config');
const proxyManager = require('./src/core/proxy');

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
});

// Load private keys
async function loadPrivateKeys() {
  try {
    // Ensure data directory exists
    await fs.mkdir('data', { recursive: true });
    
    // Try to read pk.txt
    try {
      const pkFile = await fs.readFile('data/pk.txt', 'utf8');
      const privateKeys = pkFile.split('\n')
        .map(line => line.trim())
        .filter(line => line);
      
      logger.success(`Loaded ${privateKeys.length} private keys`);
      return privateKeys;
    } catch (err) {
      // Create empty file if not exists
      if (err.code === 'ENOENT') {
        logger.error('data/pk.txt not found, creating empty file');
        await fs.writeFile('data/pk.txt', '', 'utf8');
        logger.error('Please add private keys to data/pk.txt, one per line');
        process.exit(1);
      } else {
        throw err;
      }
    }
  } catch (error) {
    logger.error(`Error loading private keys: ${error.message}`);
    throw new Error('Unable to load private keys. Make sure data/pk.txt exists.');
  }
}

// Process wallet operations
async function processWallet(privateKey, configObj, walletNum) {
  return error.withRetry(async () => {
    const walletLogger = logger.getInstance(walletNum);
    
    // Set wallet number in proxy manager
    proxyManager.setWalletNum(walletNum);
    
    // Dynamically import to avoid circular dependencies
    const Registry = require('./src/operations/registry');
    const registry = new Registry(privateKey, configObj, walletNum);
    
    return await registry.executeAll();
  }, {
    logger,
    walletNum,
    operationName: 'wallet operations',
    maxRetries: 0
  });
}

// Wait between wallets
async function waitBetweenWallets(walletLogger) {
  const waitTime = Math.floor(Math.random() * 11) + 5; // 5-15 seconds
  walletLogger.warn(`Waiting ${waitTime} seconds before next wallet...`);
  await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
}

// Countdown timer
async function countdownTimer(hours = 8) {
  const totalSeconds = hours * 3600;
  let remainingSeconds = totalSeconds;
  
  logger.setWalletNum(null);
  const countdownLogger = logger.getInstance();

  while (remainingSeconds > 0) {
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      chalk.blue(`${countdownLogger.getTimestamp()} Next cycle in: `) + 
      chalk.yellow(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
    );

    await new Promise(resolve => setTimeout(resolve, 1000));
    remainingSeconds--;
  }

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  countdownLogger.success(`Countdown completed!`);
}

// Main function
async function main() {
  while (true) {
    logger.setWalletNum(null);
    banner.showBanner();

    try {
      // Load configuration
      await config.load();
      
      // Initialize proxy manager with config
      await proxyManager.initialize(config);
      
      // Load private keys
      const privateKeys = await loadPrivateKeys();
      
      // Set log level from config
      if (config.get('general.log_level')) {
        logger.setLogLevel(config.get('general.log_level'));
      }
      
      logger.success(`Found ${privateKeys.length} private keys`);
      logger.info(`Initializing automation...`);
      logger.header(`Processing ${privateKeys.length} wallets...`);

      // Process each wallet
      for (let i = 0; i < privateKeys.length; i++) {
        const walletNum = i + 1;
        const pk = privateKeys[i];
        
        logger.setWalletNum(walletNum);
        const walletLogger = logger.getInstance(walletNum);
        
        console.log(''); // Add newline for readability
        walletLogger.header(`Processing Wallet ${walletNum}/${privateKeys.length}`);
        
        await processWallet(pk, config, walletNum);

        // Wait between wallets if not the last one
        if (i < privateKeys.length - 1) {
          await waitBetweenWallets(walletLogger);
        }
      }

      // Reset to global logger for completion message
      logger.setWalletNum(null);
      logger.header('Wallet processing completed! Starting 8-hour countdown...');

      // Start the countdown timer
      await countdownTimer(8);

    } catch (error) {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  }
}

// Start the application
main().catch(console.error);