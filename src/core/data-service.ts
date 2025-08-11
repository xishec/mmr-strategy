import { MarketData } from "./models";
import { DATA_CONFIG } from "./data-config";

/**
 * Service for loading market data from remote GitHub URLs
 */
export class DataService {
  private static instance: DataService;
  private marketDataCache: MarketData | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = DATA_CONFIG.CACHE_DURATION_MS;

  private constructor() {}

  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  /**
   * Fetch data from a remote URL with timeout and error handling
   */
  private async fetchFromUrl(url: string, timeout: number = 10000): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Successfully loaded data from ${url}`);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn(`Failed to load data from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Load data from local files (for development)
   */
  private async loadFromLocalFiles(): Promise<MarketData> {
    try {
      console.log("Loading data from local files...");
      const marketData = {
        QQQ: (await import("../data/QQQ.json")).default,
        TQQQ: (await import("../data/TQQQ.json")).default,
      };
      console.log("Successfully loaded data from local files");
      return marketData;
    } catch (error) {
      console.error("Failed to load local data:", error);
      throw new Error("Failed to load market data from local files");
    }
  }

  /**
   * Determine if we should use cached data
   */
  private shouldUseCache(): boolean {
    return (
      this.marketDataCache !== null &&
      Date.now() - this.lastFetchTime < this.CACHE_DURATION
    );
  }

  /**
   * Main method to load market data from remote URLs or local files
   */
  public async loadMarketData(): Promise<MarketData> {
    // Return cached data if available and fresh
    if (this.shouldUseCache()) {
      console.log("Using cached market data");
      return this.marketDataCache!;
    }

    // Use local files in development due to CORS restrictions
    if (DATA_CONFIG.USE_LOCAL_IN_DEVELOPMENT) {
      console.log("Development mode: using local files");
      this.marketDataCache = await this.loadFromLocalFiles();
      this.lastFetchTime = Date.now();
      return this.marketDataCache;
    }

    const qqqUrl = DATA_CONFIG.QQQ_DATA_URL;
    const tqqqUrl = DATA_CONFIG.TQQQ_DATA_URL;

    console.log("Production mode: attempting to load data from remote URLs...");
    
    // Fetch both datasets in parallel
    const [qqqData, tqqqData] = await Promise.all([
      this.fetchFromUrl(qqqUrl),
      this.fetchFromUrl(tqqqUrl),
    ]);

    const marketData: MarketData = {
      QQQ: qqqData,
      TQQQ: tqqqData,
    };

    // Cache the successful result
    this.marketDataCache = marketData;
    this.lastFetchTime = Date.now();

    console.log("Successfully loaded data from remote URLs");
    return marketData;
  }

  /**
   * Force refresh data (bypass cache)
   */
  public async refreshData(): Promise<MarketData> {
    this.marketDataCache = null;
    this.lastFetchTime = 0;
    return this.loadMarketData();
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.marketDataCache = null;
    this.lastFetchTime = 0;
  }

  /**
   * Get the timestamp of when data was last fetched
   */
  public getLastFetchTime(): number {
    return this.lastFetchTime;
  }
}
