// ASCII banner generation
const figlet = require('figlet');
const chalk = require('chalk');
const logger = require('./logger');

// Generate an ASCII art banner with shadow effect
function generateBanner(text = 'Chainbase') {
  try {
    // Generate ASCII art text
    const figletText = figlet.textSync(text, {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 120
    });
    
    // Add color
    const coloredText = chalk.cyan(figletText);
    
    // Create border
    const width = Math.max(...figletText.split('\n').map(line => line.length));
    const border = chalk.blue('═'.repeat(width));
    
    // Add timestamp
    const timestamp = logger.getInstance().getTimestamp();
    
    return `\n${border}\n${coloredText}\n${border}\n${chalk.blue(timestamp)} ${chalk.white.bold('Automation Started')}\n`;
  } catch (error) {
    // Fallback if figlet fails
    console.error(`Error generating banner: ${error.message}`);
    return `\n${chalk.cyan.bold('===== Chainbase Testnet Automation Tool =====')}\n`;
  }
}

// Display banner
function showBanner() {
  console.log(generateBanner());
}

// Generate completion banner
function generateCompletionBanner(message = 'Automation Completed') {
  try {
    const figletText = figlet.textSync(message, {
      font: 'Small',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80
    });
    
    const coloredText = chalk.green(figletText);
    const width = Math.max(...figletText.split('\n').map(line => line.length));
    const border = chalk.green('='.repeat(width));
    const timestamp = logger.getInstance().getTimestamp();
    
    return `\n${border}\n${coloredText}\n${border}\n${chalk.green(timestamp)} ${chalk.white.bold('Process finished successfully')}\n`;
  } catch (error) {
    return `\n${chalk.green.bold('===== Automation Completed Successfully =====')}\n`;
  }
}

// Display completion banner
function showCompletionBanner(message) {
  console.log(generateCompletionBanner(message));
}

module.exports = {
  generateBanner,
  showBanner,
  generateCompletionBanner,
  showCompletionBanner
};