#!/usr/bin/env npx tsx

import * as fs from "fs";
import * as path from "path";
import * as nodemailer from "nodemailer";
import * as dotenv from "dotenv";
import { runSingleSimulation } from "./src/core/core-logic";
import { MarketData, Simulation, SignalType } from "./src/core/models";

// Load environment variables from .env file
dotenv.config();

/**
 * Daily email simulation script that sends reports with latest signals and recent orders
 * Can be executed from command line with: npx tsx standalone-simulation-email.ts
 *
 * Environment variables required:
 * - EMAIL_FROM: Sender email address
 * - EMAIL_TO: Recipient email address
 * - EMAIL_HOST: SMTP host (e.g., smtp.gmail.com)
 * - EMAIL_PORT: SMTP port (e.g., 587)
 * - EMAIL_USER: SMTP username
 * - EMAIL_PASS: SMTP password or app password
 */

// Default variables from useSimulation hook
const DEFAULT_SIMULATION_VARIABLES = {
  initialMoney: 200000,
  cashYearRate: 2000,
  SMAUpMargin: 0.0,
  SMADownMargin: -0.0,
  monthlyNewCash: 0,
  buyAtOpen: true,
};

// Email configuration interface
interface EmailConfig {
  from: string;
  to: string;
  host: string;
  port: number;
  user: string;
  pass: string;
}

/**
 * Load email configuration from environment variables
 */
function loadEmailConfig(): EmailConfig {
  const requiredEnvVars = ["EMAIL_FROM", "EMAIL_TO", "EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"];
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please set these variables or create a .env file with the email configuration."
    );
  }

  return {
    from: process.env.EMAIL_FROM!,
    to: process.env.EMAIL_TO!,
    host: process.env.EMAIL_HOST!,
    port: parseInt(process.env.EMAIL_PORT!),
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASS!,
  };
}

/**
 * Calculate SMA200 and maxClose for market data
 */
function calculateSMAAndMaxClose(marketData: MarketData): void {
  // Process QQQ data
  const qqqDates = Object.keys(marketData.QQQ);
  const qqqClosePrices: number[] = [];
  let qqqMaxClose = 0;

  qqqDates.forEach((date, index) => {
    const dailyData = marketData.QQQ[date];
    qqqClosePrices.push(dailyData.close);

    qqqMaxClose = Math.max(qqqMaxClose, dailyData.close);
    dailyData.maxClose = qqqMaxClose;

    if (index >= 199) {
      const sma200 = qqqClosePrices.slice(index - 199, index + 1).reduce((sum, price) => sum + price, 0) / 200;
      dailyData.sma = sma200;
    } else {
      dailyData.sma = null;
    }
  });

  // Process TQQQ data
  const tqqqDates = Object.keys(marketData.TQQQ);
  const tqqqClosePrices: number[] = [];
  let tqqqMaxClose = 0;

  tqqqDates.forEach((date, index) => {
    const dailyData = marketData.TQQQ[date];
    tqqqClosePrices.push(dailyData.close);

    tqqqMaxClose = Math.max(tqqqMaxClose, dailyData.close);
    dailyData.maxClose = tqqqMaxClose;

    if (index >= 199) {
      const sma200 = tqqqClosePrices.slice(index - 199, index + 1).reduce((sum, price) => sum + price, 0) / 200;
      dailyData.sma = sma200;
    } else {
      dailyData.sma = null;
    }
  });
}

/**
 * Load market data from local JSON files
 */
async function loadMarketData(): Promise<MarketData> {
  try {
    console.log("Loading market data from local files...");

    const qqqPath = path.join(__dirname, "src", "data", "QQQ.json");
    const tqqqPath = path.join(__dirname, "src", "data", "TQQQ.json");

    const rawQQQData = JSON.parse(fs.readFileSync(qqqPath, "utf8"));
    const rawTQQQData = JSON.parse(fs.readFileSync(tqqqPath, "utf8"));

    // Transform raw data to include sma and maxClose properties
    const transformedQQQData: Record<string, any> = {};
    for (const [date, data] of Object.entries(rawQQQData)) {
      transformedQQQData[date] = {
        ...(data as any),
        sma: null,
        maxClose: null,
      };
    }

    const transformedTQQQData: Record<string, any> = {};
    for (const [date, data] of Object.entries(rawTQQQData)) {
      transformedTQQQData[date] = {
        ...(data as any),
        sma: null,
        maxClose: null,
      };
    }

    const marketData = {
      QQQ: transformedQQQData,
      TQQQ: transformedTQQQData,
    };

    console.log("Successfully loaded market data from local files");
    return marketData;
  } catch (error) {
    console.error("Failed to load market data:", error);
    throw new Error("Failed to load market data from local files");
  }
}

/**
 * Format number as percentage
 */
function formatPercentage(num: number): string {
  return (num * 100).toFixed(2) + "%";
}

/**
 * Format number as currency
 */
function formatCurrency(num: number): string {
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get signal description for email
 */
function getSignalDescription(signalType: SignalType): string {
  const descriptions = {
    [SignalType.Buy]:
      "🟢 Buy - Time to enter the market<br><img src='https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXJwejRjOXYxYWttc2J5ZTV2eTNyZDY3MmR1OXRrMzZqdTEyOXM5ZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/h1QI7dgjZUJO60nu2X/giphy.gif' width='400' alt='Buy signal'>",
    [SignalType.Hold]:
      "🔵 Hold - Maintain current position<br><img src='https://raw.githubusercontent.com/xishec/mmr-strategy/refs/heads/main/public/pepe-meditation.gif' width='400' alt='Hold signal'>",
    [SignalType.Sell]:
      "🔴 Sell - Exit positions immediately<br><img src='https://raw.githubusercontent.com/xishec/mmr-strategy/refs/heads/main/public/warren-buffett-panic.jpeg' width='400' alt='Sell signal'>",
    [SignalType.WaitingForSmallDrop]:
      "🟡 Waiting for small drop - Looking for entry opportunity<br><img src='https://media.giphy.com/media/QBd2kLB5qDmysEXre9/giphy.gif' width='400' alt='Waiting for small drop'>",
    [SignalType.WaitingForSmallRecovery]:
      "🟡 Waiting for small recovery - Monitoring for entry<br><img src='https://media.giphy.com/media/QBd2kLB5qDmysEXre9/giphy.gif' width='400' alt='Waiting for recovery'>",
    [SignalType.WaitingForDrop]:
      "🟠 Waiting for drop - Staying in cash<br><img src='https://media.giphy.com/media/QBd2kLB5qDmysEXre9/giphy.gif' width='400' alt='Waiting for drop'>",
    [SignalType.WaitingForRecovery]:
      "🟠 Waiting for recovery - Staying in cash until recovery<br><img src='https://media.giphy.com/media/QBd2kLB5qDmysEXre9/giphy.gif' width='400' alt='Waiting for recovery'>",
  };

  return (
    descriptions[signalType] ||
    `${signalType} - Unknown signal<br><img src='https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif' width='400' alt='Unknown signal'>`
  );
}

/**
 * Create HTML email content
 */
function createEmailContent(result: Simulation, currentDate: string): { subject: string; html: string } {
  const latestSnapshot = result.portfolioSnapshots[result.portfolioSnapshots.length - 1];
  const signal = latestSnapshot?.signal;
  const signalDescription = signal ? getSignalDescription(signal.signalType) : "No signal available";

  // Get recent orders (last 10)
  const recentOrders = result.report.orders.slice(-10).reverse();
  const ordersHtml =
    recentOrders.length > 0
      ? recentOrders
          .map((order) => {
            const action = order.type === SignalType.Buy ? "🟢 Buy" : "🔴 Sell";
            return `<tr><td>${order.date}</td><td>${action}</td></tr>`;
          })
          .join("")
      : '<tr><td colspan="2">No recent orders</td></tr>';

  const subject = `MMR Strategy Daily Report - ${currentDate} - ${signal?.signalType || "N/A"}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.4; padding: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background-color: #f0f0f0; }
        h1 { text-align: center; }
        h3 { margin-top: 25px; }
        .signal { text-align: center; font-weight: bold; margin: 20px 0; padding: 15px; border: 1px solid #ccc; }
        .signal img { margin-top: 10px; border-radius: 5px; display: block; margin-left: auto; margin-right: auto; }
      </style>
    </head>
    <body>
      <h1>MMR Strategy Daily Report</h1>
      <p style="text-align: center;">${currentDate}</p>
      
      <div class="signal">
        Current Signal<br>
        ${signalDescription}
      </div>

      <h3>📋 Recent Orders (Last 10)</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${ordersHtml}
        </tbody>
      </table>

      <hr>
      <p style="text-align: center; font-size: 12px; color: #666;">
        This report was automatically generated by the MMR Strategy system.<br>
        Report generated at: ${new Date().toLocaleString()}
      </p>
    </body>
    </html>
  `;

  return { subject, html };
}

/**
 * Send email with simulation results
 */
async function sendEmail(emailConfig: EmailConfig, subject: string, htmlContent: string): Promise<void> {
  try {
    console.log("Configuring email transporter...");

    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465, // true for 465, false for other ports
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });

    console.log("Verifying email configuration...");
    await transporter.verify();
    console.log("Email configuration verified successfully");

    const mailOptions = {
      from: emailConfig.from,
      to: emailConfig.to,
      subject: subject,
      html: htmlContent,
    };

    console.log("Sending email...");
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully: ${info.messageId}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

/**
 * Main function to run the daily email simulation
 */
async function runDailyEmailSimulation() {
  try {
    console.log("=== MMR Strategy Daily Email Report ===\n");

    // Load email configuration
    console.log("Loading email configuration...");
    const emailConfig = loadEmailConfig();
    console.log(`Email will be sent from ${emailConfig.from} to ${emailConfig.to}\n`);

    // Load market data
    const marketData = await loadMarketData();

    // Calculate SMA and MaxClose
    console.log("Calculating SMA200 and MaxClose values...");
    calculateSMAAndMaxClose(marketData);

    // Get date range from market data
    const qqqDates = Object.keys(marketData.QQQ).sort();
    const startDate = qqqDates[0];
    const endDate = qqqDates[qqqDates.length - 1];
    const currentDate = getCurrentDate();

    console.log(`Data range: ${startDate} to ${endDate}`);
    console.log(`Report date: ${currentDate}\n`);

    // Create simulation with default variables
    const simulation: Simulation = {
      portfolioSnapshots: [],
      simulationVariables: {
        ...DEFAULT_SIMULATION_VARIABLES,
        startDate,
        endDate,
      },
      report: {
        orders: [],
      },
    };

    // Run the simulation
    console.log("Running simulation...");
    const startTime = Date.now();
    const result = runSingleSimulation(simulation, marketData);
    const endTime = Date.now();

    console.log(`Simulation completed in ${endTime - startTime}ms\n`);

    // Create email content
    console.log("Preparing email content...");
    const { subject, html } = createEmailContent(result, currentDate);

    // Send email
    await sendEmail(emailConfig, subject, html);

    // Show summary to console
    const latestSnapshot = result.portfolioSnapshots[result.portfolioSnapshots.length - 1];
    if (latestSnapshot) {
      console.log("=== Email sent successfully ===");
      console.log(`Current Signal: ${latestSnapshot.signal.signalType}`);
      console.log(`Portfolio Value: ${formatCurrency(latestSnapshot.investments.total)}`);
      console.log(`Recent Orders: ${result.report.orders.slice(-5).length} in last 5 trades`);
      console.log(`Recipient: ${emailConfig.to}`);
    }

    console.log("\n=== Daily email report complete ===");
  } catch (error) {
    console.error("Error running daily email simulation:", error);
    process.exit(1);
  }
}

// Run the daily email simulation if this file is executed directly
if (require.main === module) {
  runDailyEmailSimulation();
}

export { runDailyEmailSimulation };
