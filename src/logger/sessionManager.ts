import { v4 as uuidv4 } from 'uuid';
import { SessionInfo } from '../types/index';

export class SessionManager {
  private currentSession: SessionInfo | null = null;
  private static instance: SessionManager;

  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public startNewSession(): SessionInfo {
    const timestamp = Date.now();
    const sessionId = `session_${Math.floor(timestamp / 1000)}_${uuidv4().slice(0, 8)}`;
    
    this.currentSession = {
      sessionId,
      timestamp,
      startTime: timestamp,
    };

    return this.currentSession;
  }

  public getCurrentSession(): SessionInfo | null {
    return this.currentSession;
  }

  public endCurrentSession(): SessionInfo | null {
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      const endedSession = { ...this.currentSession };
      this.currentSession = null;
      return endedSession;
    }
    return null;
  }

  public getSessionId(): string {
    if (!this.currentSession) {
      throw new Error('No active session. Call startNewSession() first.');
    }
    return this.currentSession.sessionId;
  }

  public isSessionActive(): boolean {
    return this.currentSession !== null;
  }
}
