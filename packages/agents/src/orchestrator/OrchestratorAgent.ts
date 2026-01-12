import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent, type AgentConfig } from '../base/BaseAgent';
import { EventBus } from '@arcvest/services';
import type { AgentTask, ApprovalItem, WorkflowInstance } from '@arcvest/shared';

interface WorkflowStep {
  agent: string;
  taskType: string;
  payload: Record<string, unknown>;
}

interface WorkflowDefinition {
  name: string;
  steps: WorkflowStep[];
}

export class OrchestratorAgent extends BaseAgent {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  constructor(supabase?: SupabaseClient) {
    super({
      name: 'orchestrator',
      displayName: 'Orchestrator',
      description: 'Coordinates tasks between agents and manages workflows',
      supabase,
    });

    this.registerWorkflows();
    this.setupEventListeners();
  }

  /**
   * Register built-in workflow definitions.
   */
  private registerWorkflows(): void {
    // New blog post workflow
    this.workflows.set('new_blog_post', {
      name: 'New Blog Post',
      steps: [
        { agent: 'seo', taskType: 'create_content_brief', payload: {} },
        { agent: 'content', taskType: 'create_outline', payload: {} },
        { agent: 'content', taskType: 'write_draft', payload: {} },
        { agent: 'content', taskType: 'compliance_check', payload: {} },
        // After approval, content agent publishes
      ],
    });

    // New ad campaign workflow
    this.workflows.set('new_ad_campaign', {
      name: 'New Ad Campaign',
      steps: [
        { agent: 'creative', taskType: 'generate_ad_copy', payload: {} },
        { agent: 'creative', taskType: 'compliance_check', payload: {} },
        // After approval, paid_media agent creates campaign
        { agent: 'paid_media', taskType: 'create_campaign', payload: {} },
      ],
    });

    // Daily reporting workflow
    this.workflows.set('daily_report', {
      name: 'Daily Report',
      steps: [
        { agent: 'analytics', taskType: 'sync_google_analytics', payload: {} },
        { agent: 'paid_media', taskType: 'sync_google_ads', payload: {} },
        { agent: 'analytics', taskType: 'calculate_daily_metrics', payload: {} },
        { agent: 'analytics', taskType: 'generate_daily_digest', payload: {} },
      ],
    });
  }

  /**
   * Set up event listeners.
   */
  private setupEventListeners(): void {
    // Listen for approval completions
    EventBus.on('agent:approval_completed', async (data) => {
      await this.handleApprovalCompletion(data.approvalId, data.status);
    });

    // Listen for lead score thresholds
    EventBus.on('lead:score_threshold_reached', async (data) => {
      if (data.threshold === 'hot') {
        this.logger.info(`Hot lead detected: ${data.contact.email}`);
        // Could trigger a workflow or create a task
      }
    });
  }

  /**
   * Main run loop.
   */
  async run(): Promise<void> {
    this.logger.debug('Running orchestrator cycle');

    // Process pending tasks
    const tasks = await this.getPendingTasks();
    for (const task of tasks) {
      await this.processTask(task);
    }

    // Check for stalled workflows
    await this.checkStalledWorkflows();

    // Update status
    const pendingCount = await this.countPendingTasks();
    await this.updateStatus({
      last_run_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      tasks_pending: pendingCount,
    });
  }

  /**
   * Execute a task.
   */
  protected async executeTask(task: AgentTask): Promise<unknown> {
    // Cast to string to allow internal orchestrator task types
    const taskType = task.type as string;

    switch (taskType) {
      case 'start_workflow':
        return this.startWorkflow(
          task.payload['workflow_type'] as string,
          task.payload['initial_data'] as Record<string, unknown>
        );

      case 'advance_workflow':
        return this.advanceWorkflow(task.payload['workflow_id'] as string);

      case 'distribute_task':
        return this.distributeTask(task.payload);

      case 'check_approvals':
        return this.checkPendingApprovals();

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Start a new workflow instance.
   */
  async startWorkflow(
    workflowType: string,
    initialData: Record<string, unknown> = {}
  ): Promise<string> {
    const definition = this.workflows.get(workflowType);
    if (!definition) {
      throw new Error(`Unknown workflow type: ${workflowType}`);
    }

    // Create workflow instance
    const { data, error } = await this.supabase
      .from('workflow_instances')
      .insert({
        workflow_type: workflowType,
        status: 'running',
        current_step: 0,
        total_steps: definition.steps.length,
        payload: initialData,
        step_results: [],
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create workflow: ${error.message}`);
    }

    this.logger.info(`Started workflow: ${definition.name} (${data.id})`);

    // Start the first step
    await this.advanceWorkflow(data.id);

    return data.id;
  }

  /**
   * Advance a workflow to the next step.
   */
  async advanceWorkflow(workflowId: string): Promise<void> {
    // Get workflow instance
    const { data: workflow, error: fetchError } = await this.supabase
      .from('workflow_instances')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (fetchError || !workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status !== 'running') {
      this.logger.info(`Workflow ${workflowId} is not running (${workflow.status})`);
      return;
    }

    const definition = this.workflows.get(workflow.workflow_type);
    if (!definition) {
      throw new Error(`Unknown workflow type: ${workflow.workflow_type}`);
    }

    // Check if workflow is complete
    if (workflow.current_step >= definition.steps.length) {
      await this.completeWorkflow(workflowId);
      return;
    }

    // Get current step
    const step = definition.steps[workflow.current_step];
    if (!step) {
      throw new Error(`Step not found: ${workflow.current_step}`);
    }

    // Create task for the step
    const payload = {
      ...step.payload,
      workflow_id: workflowId,
      workflow_data: workflow.payload,
    };

    await this.createTaskForAgent(step.agent, step.taskType, payload);

    // Update workflow current step
    await this.supabase
      .from('workflow_instances')
      .update({ current_step: workflow.current_step + 1 })
      .eq('id', workflowId);
  }

  /**
   * Complete a workflow.
   */
  private async completeWorkflow(workflowId: string): Promise<void> {
    await this.supabase
      .from('workflow_instances')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', workflowId);

    this.logger.info(`Workflow completed: ${workflowId}`);
  }

  /**
   * Create a task for a specific agent.
   */
  async createTaskForAgent(
    agent: string,
    taskType: string,
    payload: Record<string, unknown>,
    priority: number = 3
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .insert({
        type: taskType,
        assigned_agent: agent,
        payload,
        priority,
        created_by: this.name,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    EventBus.emit('agent:task_created', {
      taskId: data.id,
      type: taskType,
      assignedAgent: agent,
    });

    this.logger.info(`Created task for ${agent}: ${taskType} (${data.id})`);
    return data.id;
  }

  /**
   * Distribute a task to the appropriate agent.
   */
  private async distributeTask(payload: Record<string, unknown>): Promise<void> {
    const { taskType, targetAgent, taskPayload, priority } = payload;

    await this.createTaskForAgent(
      targetAgent as string,
      taskType as string,
      taskPayload as Record<string, unknown>,
      (priority as number) || 3
    );
  }

  /**
   * Handle approval completion.
   */
  private async handleApprovalCompletion(approvalId: string, status: string): Promise<void> {
    // Get the approval
    const { data: approval } = await this.supabase
      .from('approval_queue')
      .select('*')
      .eq('id', approvalId)
      .single();

    if (!approval) {
      this.logger.warn(`Approval not found: ${approvalId}`);
      return;
    }

    // If approved and has a related task, we might need to continue a workflow
    if (status === 'approved' && approval.related_task_id) {
      // Check if this was part of a workflow
      const { data: task } = await this.supabase
        .from('agent_tasks')
        .select('payload')
        .eq('id', approval.related_task_id)
        .single();

      if (task?.payload?.workflow_id) {
        await this.advanceWorkflow(task.payload.workflow_id);
      }
    }
  }

  /**
   * Check for pending approvals that need reminders.
   */
  private async checkPendingApprovals(): Promise<void> {
    const { data: approvals } = await this.supabase
      .from('pending_approvals')
      .select('*')
      .eq('urgency_status', 'needs_reminder')
      .is('reminder_sent_at', null);

    if (!approvals || approvals.length === 0) {
      return;
    }

    for (const approval of approvals) {
      this.logger.info(`Approval needs reminder: ${approval.title}`);
      // Would trigger notification here
    }
  }

  /**
   * Check for stalled workflows.
   */
  private async checkStalledWorkflows(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: workflows } = await this.supabase
      .from('workflow_instances')
      .select('*')
      .eq('status', 'running')
      .lt('updated_at', oneHourAgo);

    if (!workflows || workflows.length === 0) {
      return;
    }

    for (const workflow of workflows) {
      this.logger.warn(`Stalled workflow detected: ${workflow.id} (${workflow.workflow_type})`);
    }
  }

  /**
   * Count total pending tasks across all agents.
   */
  private async countPendingTasks(): Promise<number> {
    const { count } = await this.supabase
      .from('agent_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    return count || 0;
  }

  /**
   * Get workflow status.
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowInstance | null> {
    const { data } = await this.supabase
      .from('workflow_instances')
      .select('*')
      .eq('id', workflowId)
      .single();

    return data;
  }

  /**
   * Pause a workflow.
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    await this.supabase
      .from('workflow_instances')
      .update({ status: 'paused' })
      .eq('id', workflowId);

    this.logger.info(`Paused workflow: ${workflowId}`);
  }

  /**
   * Resume a paused workflow.
   */
  async resumeWorkflow(workflowId: string): Promise<void> {
    await this.supabase
      .from('workflow_instances')
      .update({ status: 'running' })
      .eq('id', workflowId);

    this.logger.info(`Resumed workflow: ${workflowId}`);
    await this.advanceWorkflow(workflowId);
  }
}
