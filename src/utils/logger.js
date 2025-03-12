// Enhanced logging functionality
const chalk = require('chalk');
const winston = require('winston');

class Logger {
  constructor() {
    // Store logger instances by wallet
    this.instances = new Map();
    this._defaultLogger = this._createLogger(null);
    
    // Track last used wallet number
    this._lastWalletNum = null;
    
    // Default log level
    this.logLevel = 'info'; // 'error', 'warn', 'info', 'debug'
    
    // Create winston logger for file logging
    this.winstonLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
      ]
    });
  }

  getInstance(walletNum = null) {
    // Use last wallet number if available
    if (walletNum === null && this._lastWalletNum !== null) {
      walletNum = this._lastWalletNum;
    } else if (walletNum !== null) {
      this._lastWalletNum = walletNum;
    }
    
    if (walletNum === null) {
      return this._defaultLogger;
    }
    
    if (!this.instances.has(walletNum)) {
      this.instances.set(walletNum, this._createLogger(walletNum));
    }
    
    return this.instances.get(walletNum);
  }

  _createLogger(walletNum) {
    const self = this;
    
    return {
      walletNum,
      
      getTimestamp() {
        const now = new Date();
        
        // Format date DD/MM/YYYY
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;
        
        // Format time HH:MM:SS
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const formattedTime = `${hours}:${minutes}:${seconds}`;
        
        if (this.walletNum !== null) {
          return `[${formattedDate} - ${formattedTime} - Wallet ${this.walletNum}]`;
        }
        return `[${formattedDate} - ${formattedTime} - System]`;
      },
      
      shouldLog(messageLevel) {
        const levels = {
          error: 0,
          warn: 1,
          info: 2,
          debug: 3
        };
        
        return levels[messageLevel] <= levels[self.logLevel || 'info'];
      },
      
      info(message) {
        if (this.shouldLog('info')) {
          const formattedMessage = `${this.getTimestamp()} ℹ ${message}`;
          console.log(chalk.cyan(formattedMessage));
          self.winstonLogger.info(`[Wallet ${this.walletNum || 'System'}] ${message}`);
        }
      },
      
      success(message) {
        if (this.shouldLog('info')) {
          const formattedMessage = `${this.getTimestamp()} ✓ ${message}`;
          console.log(chalk.green(formattedMessage));
          self.winstonLogger.info(`[Wallet ${this.walletNum || 'System'}] SUCCESS: ${message}`);
        }
      },
      
      warn(message) {
        if (this.shouldLog('warn')) {
          const formattedMessage = `${this.getTimestamp()} ⚠ ${message}`;
          console.log(chalk.yellow(formattedMessage));
          self.winstonLogger.warn(`[Wallet ${this.walletNum || 'System'}] ${message}`);
        }
      },
      
      error(message) {
        if (this.shouldLog('error')) {
          const formattedMessage = `${this.getTimestamp()} ✗ ${message}`;
          console.log(chalk.red(formattedMessage));
          self.winstonLogger.error(`[Wallet ${this.walletNum || 'System'}] ${message}`);
        }
      },
      
      debug(message) {
        if (this.shouldLog('debug')) {
          const formattedMessage = `${this.getTimestamp()} 🔍 ${message}`;
          console.log(chalk.gray(formattedMessage));
          self.winstonLogger.debug(`[Wallet ${this.walletNum || 'System'}] ${message}`);
        }
      },
      
      header(message) {
        if (this.shouldLog('info')) {
          // Create divider with width 80 characters
          const divider = chalk.blue("═".repeat(80));
          
          // Display divider, header, and divider
          console.log(`\n${divider}`);
          console.log(chalk.blue.bold(`${this.getTimestamp()} ${message}`));
          console.log(`${divider}\n`);
          
          self.winstonLogger.info(`[Wallet ${this.walletNum || 'System'}] HEADER: ${message}`);
        }
      },
      
      custom(message, style) {
        if (this.shouldLog('info')) {
          const formattedMessage = `${this.getTimestamp()} ${message}`;
          console.log(style(formattedMessage));
          self.winstonLogger.info(`[Wallet ${this.walletNum || 'System'}] ${message}`);
        }
      }
    };
  }

  setLogLevel(level) {
    if (['error', 'warn', 'info', 'debug'].includes(level)) {
      this.logLevel = level;
      this.winstonLogger.level = level;
    }
    return this;
  }
  
  setWalletNum(num) {
    this._lastWalletNum = num;
    this.getInstance(num);
    return this.getInstance(num);
  }
  
  getTimestamp() {
    return this.getInstance().getTimestamp();
  }

  // Proxy methods to the current instance
  info(message) {
    this.getInstance().info(message);
  }
  
  success(message) {
    this.getInstance().success(message);
  }
  
  warn(message) {
    this.getInstance().warn(message);
  }
  
  error(message) {
    this.getInstance().error(message);
  }
  
  debug(message) {
    this.getInstance().debug(message);
  }
  
  header(message) {
    this.getInstance().header(message);
  }
  
  custom(message, style) {
    this.getInstance().custom(message, style);
  }
}

module.exports = new Logger();