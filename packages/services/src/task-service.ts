import type { SupabaseClient } from '@supabase/supabase-js';
import type { Task, TaskInsert, TaskUpdate, Contact } from '@arcvest/shared';
import type { Advisor } from '@arcvest/shared';
import { getSupabase } from './supabase';
import { EventBus } from './event-bus';

export interface TaskWithContact extends Task {
  contact?: Contact | null;
}

export interface TaskSearchParams {
  assignedTo?: Advisor;
  status?: Task['status'];
  priority?: Task['priority'];
  contactId?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  limit?: number;
  offset?: number;
}

export class TaskService {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
  }

  /**
   * Create a new task.
   */
  async create(data: TaskInsert): Promise<Task> {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    EventBus.emit('task:created', { task });

    // Log activity
    await this.supabase
      .from('activity_log')
      .insert({
        actor: data.created_by || 'system',
        action: 'created',
        entity_type: 'task',
        entity_id: task.id,
        details: { title: task.title, assigned_to: task.assigned_to },
      });

    return task;
  }

  /**
   * Get a task by ID.
   */
  async getById(id: string): Promise<TaskWithContact | null> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get task: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a task.
   */
  async update(id: string, data: TaskUpdate): Promise<Task> {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }

    return task;
  }

  /**
   * Complete a task.
   */
  async complete(id: string): Promise<Task> {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete task: ${error.message}`);
    }

    EventBus.emit('task:completed', { task });

    // Log activity
    await this.supabase
      .from('activity_log')
      .insert({
        actor: 'system',
        action: 'completed',
        entity_type: 'task',
        entity_id: task.id,
        details: { title: task.title },
      });

    return task;
  }

  /**
   * Cancel a task.
   */
  async cancel(id: string): Promise<Task> {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel task: ${error.message}`);
    }

    return task;
  }

  /**
   * Delete a task.
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  }

  /**
   * Search tasks with filters.
   */
  async search(params: TaskSearchParams): Promise<{ tasks: TaskWithContact[]; total: number }> {
    const { assignedTo, status, priority, contactId, dueBefore, dueAfter, limit = 50, offset = 0 } = params;

    let query = this.supabase
      .from('tasks')
      .select(`
        *,
        contact:contacts(*)
      `, { count: 'exact' });

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    if (dueBefore) {
      query = query.lte('due_date', dueBefore.toISOString());
    }

    if (dueAfter) {
      query = query.gte('due_date', dueAfter.toISOString());
    }

    query = query
      .order('due_date', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to search tasks: ${error.message}`);
    }

    return {
      tasks: data || [],
      total: count || 0,
    };
  }

  /**
   * Get pending tasks for an advisor.
   */
  async getPendingForAdvisor(advisor: Advisor): Promise<TaskWithContact[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('assigned_to', advisor)
      .eq('status', 'pending')
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to get pending tasks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get tasks for a contact.
   */
  async getByContact(contactId: string): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select()
      .eq('contact_id', contactId)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to get tasks for contact: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get overdue tasks.
   */
  async getOverdue(): Promise<TaskWithContact[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('tasks')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('status', 'pending')
      .lt('due_date', now)
      .order('due_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get overdue tasks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get tasks due today.
   */
  async getDueToday(): Promise<TaskWithContact[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const { data, error } = await this.supabase
      .from('tasks')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('status', 'pending')
      .gte('due_date', startOfDay)
      .lt('due_date', endOfDay)
      .order('due_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get tasks due today: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get tasks due this week.
   */
  async getDueThisWeek(): Promise<TaskWithContact[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString();

    const { data, error } = await this.supabase
      .from('tasks')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('status', 'pending')
      .gte('due_date', startOfDay)
      .lt('due_date', endOfWeek)
      .order('due_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get tasks due this week: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get the pending tasks dashboard view.
   */
  async getPendingTasksDashboard(): Promise<{
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    priority: string;
    assigned_to: string;
    contact_first_name: string | null;
    contact_last_name: string | null;
    contact_email: string | null;
    urgency: string;
  }[]> {
    const { data, error } = await this.supabase
      .from('pending_tasks_dashboard')
      .select('*');

    if (error) {
      throw new Error(`Failed to get pending tasks dashboard: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a follow-up task for a contact.
   */
  async createFollowUp(contactId: string, assignedTo: Advisor, options?: {
    daysFromNow?: number;
    title?: string;
    description?: string;
    priority?: Task['priority'];
    createdBy?: string;
  }): Promise<Task> {
    const daysFromNow = options?.daysFromNow || 3;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysFromNow);

    return this.create({
      contact_id: contactId,
      assigned_to: assignedTo,
      title: options?.title || 'Follow up with contact',
      description: options?.description,
      due_date: dueDate.toISOString(),
      priority: options?.priority || 'medium',
      created_by: options?.createdBy || 'system',
    });
  }

  /**
   * Check for overdue tasks and emit events.
   */
  async checkOverdueTasks(): Promise<number> {
    const overdue = await this.getOverdue();

    for (const task of overdue) {
      EventBus.emit('task:overdue', { task });
    }

    return overdue.length;
  }
}
