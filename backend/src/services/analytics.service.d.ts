import { IncomingMessage } from 'node:http';

export interface IAnalyticsStats {
  uniqueVisitors: number;
  peopleVisitedSoFar: number;
  totalVisits: number;
}

export declare class AnalyticsService {
  recordVisit(req?: IncomingMessage): Promise<IAnalyticsStats>;
  getStats(): IAnalyticsStats;
  syncFromDb(): Promise<void>;
}

export declare const analyticsService: AnalyticsService;
