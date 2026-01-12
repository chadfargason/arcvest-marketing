import EventEmitter from 'eventemitter3';
import type { Contact, Interaction, Task } from '@arcvest/shared';

// Event types for the marketing automation system
export interface EventMap {
  // Contact events
  'contact:created': { contact: Contact };
  'contact:updated': { contact: Contact; changes: Partial<Contact> };
  'contact:deleted': { contactId: string };
  'contact:status_changed': { contact: Contact; previousStatus: string; newStatus: string };
  'contact:score_changed': { contact: Contact; previousScore: number; newScore: number };
  'contact:assigned': { contact: Contact; assignedTo: string };
  'contact:tagged': { contact: Contact; tag: string; action: 'added' | 'removed' };

  // Interaction events
  'interaction:logged': { interaction: Interaction; contact: Contact };
  'interaction:email_sent': { interaction: Interaction; contact: Contact };
  'interaction:email_opened': { interaction: Interaction; contact: Contact };
  'interaction:email_clicked': { interaction: Interaction; contact: Contact };

  // Task events
  'task:created': { task: Task };
  'task:completed': { task: Task };
  'task:overdue': { task: Task };

  // Lead scoring events
  'lead:score_threshold_reached': { contact: Contact; threshold: 'hot' | 'warm' };
  'lead:qualified': { contact: Contact };

  // Sequence events
  'sequence:enrolled': { contactId: string; sequenceId: string };
  'sequence:completed': { contactId: string; sequenceId: string };
  'sequence:email_sent': { contactId: string; sequenceId: string; stepOrder: number };

  // Agent events
  'agent:task_created': { taskId: string; type: string; assignedAgent: string };
  'agent:task_completed': { taskId: string; result: unknown };
  'agent:approval_needed': { approvalId: string; type: string };
  'agent:approval_completed': { approvalId: string; status: string };

  // System events
  'system:daily_digest': { date: string };
  'system:weekly_report': { weekStart: string };
}

type EventName = keyof EventMap;
type EventHandler<T extends EventName> = (data: EventMap[T]) => void | Promise<void>;

class EventBusClass {
  private emitter: EventEmitter;
  private handlers: Map<string, Set<Function>>;

  constructor() {
    this.emitter = new EventEmitter();
    this.handlers = new Map();
  }

  /**
   * Subscribe to an event.
   */
  on<T extends EventName>(event: T, handler: EventHandler<T>): void {
    this.emitter.on(event, handler);

    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * Subscribe to an event for a single execution.
   */
  once<T extends EventName>(event: T, handler: EventHandler<T>): void {
    this.emitter.once(event, handler);
  }

  /**
   * Unsubscribe from an event.
   */
  off<T extends EventName>(event: T, handler: EventHandler<T>): void {
    this.emitter.off(event, handler);
    this.handlers.get(event)?.delete(handler);
  }

  /**
   * Emit an event with data.
   */
  emit<T extends EventName>(event: T, data: EventMap[T]): void {
    this.emitter.emit(event, data);
  }

  /**
   * Emit an event and wait for all handlers to complete.
   */
  async emitAsync<T extends EventName>(event: T, data: EventMap[T]): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Remove all listeners for an event or all events.
   */
  removeAllListeners(event?: EventName): void {
    if (event) {
      this.emitter.removeAllListeners(event);
      this.handlers.delete(event);
    } else {
      this.emitter.removeAllListeners();
      this.handlers.clear();
    }
  }

  /**
   * Get the count of listeners for an event.
   */
  listenerCount(event: EventName): number {
    return this.emitter.listenerCount(event);
  }
}

// Export singleton instance
export const EventBus = new EventBusClass();

// Export class for testing purposes
export { EventBusClass };
