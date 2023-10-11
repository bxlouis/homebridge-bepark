import { API, DynamicPlatformPlugin, Logger, PlatformConfig, PlatformAccessory, Service, Characteristic } from 'homebridge';
import fetch from 'node-fetch';

const API_BASE_URL = 'https://api-v3.bepark.eu';

export = (api: API) => {
  api.registerPlatform('BeParkGarageDoor', BeParkGarageDoor);
}

class BeParkGarageDoor implements DynamicPlatformPlugin {
  private readonly log: Logger;
  private readonly config: PlatformConfig;
  private readonly accessories: PlatformAccessory[] = [];
  
  private accessToken?: string;
  private refreshToken?: string;
  private tokenType?: string;
  private expiresIn?: number;
  
  constructor(log: Logger, config: PlatformConfig, api: API) {
    this.log = log;
    this.config = config;

    api.on('didFinishLaunching', () => {
      log.info('Initialized platform:', this.config.name);
      // Discover/register accessories...
    });
  }

  async authenticate(): Promise<any> {
    return this.performRequest('/oauth/token', 'POST', {
      grant_type: 'password',
      client_id: 3,
      client_secret: this.config.client_secret,
      username: this.config.username,
      password: this.config.password
    });
  }

  async refreshToken(): Promise<any> {
    return this.performRequest('/oauth/token', 'POST', {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: 3,
      client_secret: this.config.client_secret
    });
  }

  async getUserDetails(): Promise<any> {
    return this.performRequest('/api/v3/user/by-token');
  }

  async getGateDetails(): Promise<any> {
    return this.performRequest(`/api/v3/user/${this.config.user_id}/access`);
  }

  async openDoor(): Promise<any> {
    const params = `coordinate%5Blat%5D=${this.config.latitude}&coordinate%5Blng%5D=${this.config.longitude}&pedestrian=1&purchase_id=${this.config.purchase_id}&user_id=${this.config.user_id}&way=pedestrian`;
    return this.performRequest(`/api/v3/gate/${this.config.gate_id}/open?${params}`, 'POST');
  }

  private async performRequest(endpoint: string, method: string = 'GET', body: any = null): Promise<any> {
    await this.ensureAuthenticated();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : null,
    });

    return response.json();
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.expiresIn) {
      const authData = await this.authenticate();
      this.setAuthData(authData);
    }
  }

  private getHeaders(): HeadersInit {
    const headers = {
      'Content-Type': 'application/json',
      'X-localization': 'en',
      'Accept': 'application/json',
      'User-Agent': 'BePark/3.1.6 (com.bepark.iphone; build:1; iOS 17.0.3) Alamofire/4.8.1',
      'Accept-Language': 'en-US;q=1.0, fr-BE;q=0.9',
      'Accept-Encoding': 'gzip;q=1.0, compress;q=0.5',
    };

    if (this.accessToken) {
      headers['Authorization'] = `${this.tokenType} ${this.accessToken}`;
    }

    return headers;
  }

  private setAuthData(data: any): void {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenType = data.token_type;
    this.expiresIn = Date.now() + (data.expires_in * 1000 - 60000);  // 60 seconds buffer
  }
}
