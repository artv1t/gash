import { EventEmitter } from 'events';
import { TokenEvent } from '../types/index';

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private eventCounts = new Map<string, number>();

  private constructor() {
    super();
    this.setMaxListeners(1000);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emitTokenEvent(event: TokenEvent): void {
    this.incrementCounter('token_detected');
    console.log(`📡 EventBus: Token detected ${event.mintAddress} from ${event.source}`);
    this.emit('token_detected', event);
  }

  onTokenDetected(callback: (event: TokenEvent) => void): void {
    this.on('token_detected', callback);
  }

  private incrementCounter(event: string): void {
    const current = this.eventCounts.get(event) || 0;
    this.eventCounts.set(event, current + 1);
  }

  getEventCounts(): Map<string, number> {
    return new Map(this.eventCounts);
  }

  destroy(): void {
    this.removeAllListeners();
  }
}
