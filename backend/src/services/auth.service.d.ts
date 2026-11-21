export interface IUserStats {
  sessionsCompleted: number;
  questionsAttempted: number;
  correctAnswers: number;
}

export interface IUserProfile {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
  lastLoginAt: string;
  stats: IUserStats;
}

export interface IAuthResult {
  success: boolean;
  user: IUserProfile;
  token: string;
  isDemo?: boolean;
}

export declare class AuthService {
  getConfig(): { googleClientId: string; configured: boolean };
  verifyGoogleCredential(credential: string): Promise<any>;
  upsertUser(profile: any): Promise<IUserProfile>;
  createSession(user: IUserProfile): string;
  loginWithGoogle(credential: string, customUsername?: string): Promise<IAuthResult>;
  loginWithDemo(demoData?: { name?: string; email?: string; picture?: string }): Promise<IAuthResult>;
  updateUserProfile(userId: string, updates: { name: string }): Promise<IUserProfile>;
  getUserByToken(token: string): Promise<IUserProfile | null>;
  logout(token: string): boolean;
  incrementUserStats(userId: string, statKey: keyof IUserStats, incrementBy?: number): Promise<void>;
}

export declare const authService: AuthService;
