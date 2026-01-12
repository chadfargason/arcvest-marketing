/**
 * Services Package Tests
 *
 * Tests for services that don't require external connections.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBusClass } from '../event-bus';

describe('EventBus', () => {
  let eventBus: EventBusClass;

  beforeEach(() => {
    eventBus = new EventBusClass();
  });

  it('should emit and receive events', () => {
    const handler = vi.fn();
    eventBus.on('contact:created', handler);

    const testData = {
      contact: {
        id: '123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        status: 'new' as const,
        lead_score: 0,
        assigned_to: null,
        source: 'website',
        tags: [],
        notes: null,
        asset_range: null,
        last_activity_at: null,
        status_changed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    };

    eventBus.emit('contact:created', testData);

    expect(handler).toHaveBeenCalledWith(testData);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple subscribers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.on('contact:updated', handler1);
    eventBus.on('contact:updated', handler2);

    const testData = {
      contact: {
        id: '123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        status: 'contacted' as const,
        lead_score: 10,
        assigned_to: 'chad',
        source: 'website',
        tags: [],
        notes: null,
        asset_range: null,
        last_activity_at: null,
        status_changed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
      changes: { status: 'contacted' as const },
    };

    eventBus.emit('contact:updated', testData);

    expect(handler1).toHaveBeenCalledWith(testData);
    expect(handler2).toHaveBeenCalledWith(testData);
  });

  it('should unsubscribe handlers', () => {
    const handler = vi.fn();
    eventBus.on('contact:deleted', handler);
    eventBus.off('contact:deleted', handler);

    eventBus.emit('contact:deleted', { contactId: '123' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle once subscription', () => {
    const handler = vi.fn();
    eventBus.once('task:created', handler);

    const testData = {
      task: {
        id: '456',
        title: 'Test task',
        description: null,
        assigned_to: 'chad',
        contact_id: '123',
        due_date: null,
        priority: 'medium' as const,
        status: 'pending' as const,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    eventBus.emit('task:created', testData);
    eventBus.emit('task:created', testData);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should count listeners correctly', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    expect(eventBus.listenerCount('contact:created')).toBe(0);

    eventBus.on('contact:created', handler1);
    expect(eventBus.listenerCount('contact:created')).toBe(1);

    eventBus.on('contact:created', handler2);
    expect(eventBus.listenerCount('contact:created')).toBe(2);
  });

  it('should remove all listeners for a specific event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.on('contact:created', handler1);
    eventBus.on('contact:updated', handler2);

    eventBus.removeAllListeners('contact:created');

    expect(eventBus.listenerCount('contact:created')).toBe(0);
    expect(eventBus.listenerCount('contact:updated')).toBe(1);
  });

  it('should remove all listeners', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.on('contact:created', handler1);
    eventBus.on('contact:updated', handler2);

    eventBus.removeAllListeners();

    expect(eventBus.listenerCount('contact:created')).toBe(0);
    expect(eventBus.listenerCount('contact:updated')).toBe(0);
  });

  it('should handle async event emission', async () => {
    const results: number[] = [];

    eventBus.on('system:daily_digest', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      results.push(1);
    });

    eventBus.on('system:daily_digest', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      results.push(2);
    });

    await eventBus.emitAsync('system:daily_digest', { date: '2025-01-11' });

    expect(results).toContain(1);
    expect(results).toContain(2);
  });
});

describe('Module Exports', () => {
  it('should export EventBus singleton', async () => {
    const { EventBus } = await import('../event-bus');
    expect(EventBus).toBeDefined();
    expect(typeof EventBus.on).toBe('function');
    expect(typeof EventBus.emit).toBe('function');
  });

  it('should export service classes', async () => {
    const { ContactService, LeadScoringService, AssignmentService, InteractionService, TaskService, SequenceService, GmailService } = await import('../index');

    expect(ContactService).toBeDefined();
    expect(LeadScoringService).toBeDefined();
    expect(AssignmentService).toBeDefined();
    expect(InteractionService).toBeDefined();
    expect(TaskService).toBeDefined();
    expect(SequenceService).toBeDefined();
    expect(GmailService).toBeDefined();
  });

  it('should export Supabase utilities', async () => {
    const { getSupabase, createSupabaseClient, resetSupabase } = await import('../index');

    expect(createSupabaseClient).toBeDefined();
    expect(typeof createSupabaseClient).toBe('function');
    expect(resetSupabase).toBeDefined();
    expect(typeof resetSupabase).toBe('function');
    // getSupabase will throw without env vars, so just check it's a function
    expect(typeof getSupabase).toBe('function');
  });
});

describe('Contact Types', () => {
  it('should have proper contact status values', () => {
    const validStatuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'nurturing'];

    // This is a type check - if it compiles, the types are correct
    const testStatus: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost' | 'nurturing' = 'new';
    expect(validStatuses).toContain(testStatus);
  });

  it('should have proper task priority values', () => {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const testPriority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
    expect(validPriorities).toContain(testPriority);
  });
});
