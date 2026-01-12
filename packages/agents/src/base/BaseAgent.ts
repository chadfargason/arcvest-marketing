import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, EventBus } from '@arcvest/services';
import { createLogger, type Logger } from '@arcvest/shared';
import type { AgentTask, AgentStatus } from '@arcvest/shared';

export interface AgentConfig {
  name: string;
  displayName: string;
  description: string;
  supabase?: SupabaseClient;
}

export abstract class BaseAgent {
  protected name: string;
  protected displayName: string;
  protected description: string;
  protected supabase: SupabaseClient;
  protected logger: Logger;
  protected isRunning: boolean = false;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.displayName = config.displayName;
    this.description = config.description;
    this.supabase = config.supabase || getSupabase();
    this.logger = createLogger(`agent:${this.name}`);
  }

  /**
   * Initialize the agent (called once on startup).
   */
  async initialize(): Promise<void> {
    this.logger.info(`Initializing ${this.displayName}`);
    await this.updateStatus({ is_running: false, tasks_pending: 0 });
  }

  /**
   * Start the agent (begin processing tasks).
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Agent is already running');
      return;
    }

    this.isRunning = true;
    await this.updateStatus({ is_running: true });
    this.logger.info(`${this.displayName} started`);
  }

  /**
   * Stop the agent.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Agent is not running');
      return;
    }

    this.isRunning = false;
    await this.updateStatus({ is_running: false });
    this.logger.info(`${this.displayName} stopped`);
  }

  /**
   * Run a single processing cycle.
   */
  abstract run(): Promise<void>;

  /**
   * Handle an event from the EventBus.
   */
  async handleEvent(eventType: string, data: unknown): Promise<void> {
    this.logger.debug(`Received event: ${eventType}`, data);
  }

  /**
   * Process a specific task assigned to this agent.
   */
  async processTask(task: AgentTask): Promise<unknown> {
    this.logger.info(`Processing task: ${task.id} (${task.type})`);

    try {
      // Mark task as in progress
      await this.updateTaskStatus(task.id, 'in_progress');

      // Execute the task
      const result = await this.executeTask(task);

      // Mark task as complete
      await this.updateTaskStatus(task.id, 'complete', result);

      this.logger.info(`Task ${task.id} completed successfully`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Task ${task.id} failed: ${message}`);

      // Increment attempts and potentially mark as failed
      await this.handleTaskError(task, message);
      throw error;
    }
  }

  /**
   * Execute a task (implemented by specific agents).
   */
  protected abstract executeTask(task: AgentTask): Promise<unknown>;

  /**
   * Fetch pending tasks for this agent.
   */
  protected async getPendingTasks(): Promise<AgentTask[]> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('assigned_agent', this.name)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch pending tasks', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update task status.
   */
  protected async updateTaskStatus(
    taskId: string,
    status: AgentTask['status'],
    result?: unknown
  ): Promise<void> {
    const update: Partial<AgentTask> = { status };

    if (status === 'complete') {
      update.completed_at = new Date().toISOString();
      update.result = result as Record<string, unknown> | null | undefined;
    }

    const { error } = await this.supabase
      .from('agent_tasks')
      .update(update)
      .eq('id', taskId);

    if (error) {
      this.logger.error('Failed to update task status', error);
    }
  }

  /**
   * Handle task error (increment attempts, mark failed if max reached).
   */
  protected async handleTaskError(task: AgentTask, errorMessage: string): Promise<void> {
    const newAttempts = task.attempts + 1;

    const update: Partial<AgentTask> = {
      attempts: newAttempts,
      last_error: errorMessage,
    };

    const maxAttempts = 3; // Default max attempts
    if (newAttempts >= maxAttempts) {
      update.status = 'failed';
    } else {
      update.status = 'pending'; // Reset to pending for retry
    }

    const { error } = await this.supabase
      .from('agent_tasks')
      .update(update)
      .eq('id', task.id);

    if (error) {
      this.logger.error('Failed to update task error', error);
    }
  }

  /**
   * Create a new task in the queue.
   */
  protected async createTask(params: {
    type: string;
    payload: Record<string, unknown>;
    priority?: number;
    dueAt?: Date;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .insert({
        type: params.type,
        assigned_agent: this.name,
        payload: params.payload,
        priority: params.priority || 3,
        due_at: params.dueAt?.toISOString(),
        created_by: this.name,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    EventBus.emit('agent:task_created', {
      taskId: data.id,
      type: params.type,
      assignedAgent: this.name,
    });

    return data.id;
  }

  /**
   * Submit content for approval.
   */
  protected async submitForApproval(params: {
    type: string;
    title: string;
    summary?: string;
    content: Record<string, unknown>;
    priority?: 'high' | 'medium' | 'low';
    relatedTaskId?: string;
    contentId?: string;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('approval_queue')
      .insert({
        type: params.type,
        title: params.title,
        summary: params.summary,
        content: params.content,
        priority: params.priority || 'medium',
        created_by: this.name,
        related_task_id: params.relatedTaskId,
        content_id: params.contentId,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to submit for approval: ${error.message}`);
    }

    EventBus.emit('agent:approval_needed', {
      approvalId: data.id,
      type: params.type,
    });

    this.logger.info(`Submitted for approval: ${params.title} (${data.id})`);
    return data.id;
  }

  /**
   * Update agent status in the database.
   */
  protected async updateStatus(update: Partial<AgentStatus>): Promise<void> {
    const { error } = await this.supabase
      .from('agent_status')
      .upsert({
        agent_name: this.name,
        ...update,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      this.logger.error('Failed to update agent status', error);
    }
  }

  /**
   * Log agent activity.
   */
  protected async logActivity(params: {
    action: string;
    entityType?: string;
    entityId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from('activity_log').insert({
      actor: this.name,
      action: params.action,
      entity_type: params.entityType || 'agent',
      entity_id: params.entityId,
      details: params.details || {},
    });

    if (error) {
      this.logger.error('Failed to log activity', error);
    }
  }

  /**
   * Log scheduled job execution.
   */
  protected async logJobExecution(
    jobName: string,
    status: 'started' | 'completed' | 'failed',
    startedAt: Date,
    errorMessage?: string
  ): Promise<void> {
    const now = new Date();
    const { error } = await this.supabase.from('scheduled_job_log').insert({
      job_name: jobName,
      agent_name: this.name,
      status,
      started_at: startedAt.toISOString(),
      completed_at: status !== 'started' ? now.toISOString() : null,
      duration_ms: status !== 'started' ? now.getTime() - startedAt.getTime() : null,
      error_message: errorMessage,
    });

    if (error) {
      this.logger.error('Failed to log job execution', error);
    }
  }
}
