'use server';

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
  exchangeRate: number; // Rate relative to USD
  lastUpdated: Date;
}

export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  timestamp: Date;
}

export interface MultiCurrencyConfig {
  baseCurrency: string;
  supportedCurrencies: string[];
  autoUpdateRates: boolean;
  updateIntervalHours: number;
}

// Default currency configurations
const DEFAULT_CURRENCIES: Omit<Currency, 'lastUpdated'>[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', isActive: true, exchangeRate: 1.0 },
  { code: 'EUR', name: 'Euro', symbol: '€', isActive: true, exchangeRate: 0.85 },
  { code: 'GBP', name: 'British Pound', symbol: '£', isActive: true, exchangeRate: 0.73 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', isActive: true, exchangeRate: 110.0 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', isActive: true, exchangeRate: 1.25 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', isActive: true, exchangeRate: 1.35 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', isActive: true, exchangeRate: 0.92 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', isActive: true, exchangeRate: 6.45 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', isActive: true, exchangeRate: 74.5 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', isActive: true, exchangeRate: 36.0 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', isActive: true, exchangeRate: 23000.0 },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', isActive: true, exchangeRate: 4000.0 },
];

/**
 * Initialize default currencies in database
 */
export async function initializeCurrencies(): Promise<void> {
  try {
    for (const currency of DEFAULT_CURRENCIES) {
      await prisma.currency.upsert({
        where: { code: currency.code },
        update: {
          name: currency.name,
          symbol: currency.symbol,
          isActive: currency.isActive,
          exchangeRate: currency.exchangeRate,
          lastUpdated: new Date()
        },
        create: {
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          isActive: currency.isActive,
          exchangeRate: currency.exchangeRate,
          lastUpdated: new Date()
        }
      });
    }

    logger.info('Currencies initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize currencies', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Get all active currencies
 */
export async function getActiveCurrencies(): Promise<Currency[]> {
  try {
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' }
    });

    return currencies.map(currency => ({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      isActive: currency.isActive,
      exchangeRate: currency.exchangeRate,
      lastUpdated: currency.lastUpdated
    }));
  } catch (error) {
    logger.error('Failed to get active currencies', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return [];
  }
}

/**
 * Get currency by code
 */
export async function getCurrency(code: string): Promise<Currency | null> {
  try {
    const currency = await prisma.currency.findUnique({
      where: { code }
    });

    if (!currency) {
      return null;
    }

    return {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      isActive: currency.isActive,
      exchangeRate: currency.exchangeRate,
      lastUpdated: currency.lastUpdated
    };
  } catch (error) {
    logger.error('Failed to get currency', {
      error: error instanceof Error ? error.message : 'Unknown error',
      code
    });
    return null;
  }
}

/**
 * Convert amount between currencies
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<CurrencyConversion | null> {
  try {
    if (fromCurrency === toCurrency) {
      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount: amount,
        exchangeRate: 1.0,
        timestamp: new Date()
      };
    }

    const [fromCurr, toCurr] = await Promise.all([
      getCurrency(fromCurrency),
      getCurrency(toCurrency)
    ]);

    if (!fromCurr || !toCurr) {
      logger.error('Currency not found for conversion', { fromCurrency, toCurrency });
      return null;
    }

    // Convert to USD first, then to target currency
    const amountInUSD = amount / fromCurr.exchangeRate;
    const convertedAmount = amountInUSD * toCurr.exchangeRate;
    const exchangeRate = toCurr.exchangeRate / fromCurr.exchangeRate;

    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount,
      exchangeRate,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Failed to convert currency', {
      error: error instanceof Error ? error.message : 'Unknown error',
      amount,
      fromCurrency,
      toCurrency
    });
    return null;
  }
}

/**
 * Update currency exchange rates
 * In production, this would fetch from external APIs
 */
export async function updateExchangeRates(): Promise<void> {
  try {
    // Simulate fetching updated rates from external API
    // In real implementation, call services like exchangerate-api.com, fixer.io, etc.

    const updatedRates: Record<string, number> = {
      'EUR': 0.85,
      'GBP': 0.73,
      'JPY': 110.0,
      'CAD': 1.25,
      'AUD': 1.35,
      'CHF': 0.92,
      'CNY': 6.45,
      'INR': 74.5,
      'THB': 36.0,
      'VND': 23000.0,
      'KHR': 4000.0
    };

    const updatePromises = Object.entries(updatedRates).map(([code, rate]) =>
      prisma.currency.update({
        where: { code },
        data: {
          exchangeRate: rate,
          lastUpdated: new Date()
        }
      })
    );

    await Promise.all(updatePromises);

    logger.info('Exchange rates updated successfully');
  } catch (error) {
    logger.error('Failed to update exchange rates', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Get company currency configuration
 */
export async function getCompanyCurrencyConfig(companyId: string): Promise<MultiCurrencyConfig | null> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        currency: true,
        // Add currency config fields if they exist in schema
      }
    });

    if (!company) {
      return null;
    }

    // For now, return default config based on company currency
    return {
      baseCurrency: company.currency || 'USD',
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'THB', 'VND', 'KHR'],
      autoUpdateRates: true,
      updateIntervalHours: 24
    };
  } catch (error) {
    logger.error('Failed to get company currency config', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });
    return null;
  }
}

/**
 * Format amount with currency symbol
 */
export async function formatCurrency(
  amount: number,
  currencyCode: string,
  locale: string = 'en-US'
): Promise<string> {
  try {
    const currency = await getCurrency(currencyCode);
    if (!currency) {
      return `${amount.toFixed(2)} ${currencyCode}`;
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    logger.error('Failed to format currency', {
      error: error instanceof Error ? error.message : 'Unknown error',
      amount,
      currencyCode
    });
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

/**
 * Calculate prices in multiple currencies for product display
 */
export async function calculateMultiCurrencyPrices(
  basePrice: number,
  baseCurrency: string = 'USD',
  targetCurrencies: string[] = ['EUR', 'GBP', 'CAD', 'AUD', 'THB']
): Promise<Record<string, number>> {
  try {
    const prices: Record<string, number> = {};

    for (const targetCurrency of targetCurrencies) {
      const conversion = await convertCurrency(basePrice, baseCurrency, targetCurrency);
      if (conversion) {
        prices[targetCurrency] = Math.round(conversion.convertedAmount * 100) / 100;
      }
    }

    return prices;
  } catch (error) {
    logger.error('Failed to calculate multi-currency prices', {
      error: error instanceof Error ? error.message : 'Unknown error',
      basePrice,
      baseCurrency
    });
    return {};
  }
}

/**
 * Validate currency code
 */
export async function isValidCurrency(code: string): Promise<boolean> {
  try {
    const currency = await getCurrency(code);
    return currency !== null;
  } catch (error) {
    logger.error('Failed to validate currency', {
      error: error instanceof Error ? error.message : 'Unknown error',
      code
    });
    return false;
  }
}

// Initialize currencies on module load
initializeCurrencies().catch(console.error);</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\services\multi-currency-service.ts