export interface Climate {
  tempLow: number;
  tempHigh: number;
  humidity: number;
}

export interface DestinationAlert {
  level: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
}

export interface Destination {
  key: string;
  name: string;
  region: string;
  climate: Climate;
  alerts: DestinationAlert[];
}
