/**
 * Content Agent
 *
 * Creates and manages marketing content including blog posts,
 * LinkedIn posts, and newsletters.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from '../base/BaseAgent';
import { ClaudeClient } from './claude-client';
import { WordPressClient } from './wordpress-client';
import type { AgentTask, ContentCalendarEntry } from '@arcvest/shared';

export class ContentAgent extends BaseAgent {
  private claude: ClaudeClient;
  private wordpress: WordPressClient | null = null;

  constructor(supabase?: SupabaseClient) {
    super({
      name: 'content',
      displayName: 'Content Agent',
      description: 'Creates blog posts, LinkedIn content, and newsletters',
      supabase,
    });

    this.claude = new ClaudeClient();

    // Initialize WordPress client if configured
    try {
      this.wordpress = new WordPressClient();
    } catch {
      this.logger.warn('WordPress client not configured');
    }
  }

  /**
   * Main run loop - process pending content tasks.
   */
  async run(): Promise<void> {
    this.logger.debug('Running content agent cycle');

    // Process pending tasks
    const tasks = await this.getPendingTasks();
    for (const task of tasks) {
      try {
        await this.processTask(task);
      } catch (error) {
        this.logger.error(`Failed to process task ${task.id}`, error);
      }
    }

    // Check for scheduled content that needs publishing
    await this.checkScheduledContent();

    // Update status
    await this.updateStatus({
      last_run_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
    });
  }

  /**
   * Execute a content task.
   */
  protected async executeTask(task: AgentTask): Promise<unknown> {
    // Cast to string to allow internal agent task types
    const taskType = task.type as string;

    switch (taskType) {
      case 'create_outline':
        return this.createOutline(task.payload);

      case 'write_draft':
        return this.writeDraft(task.payload);

      case 'create_linkedin_post':
        return this.createLinkedInPost(task.payload);

      case 'create_newsletter':
        return this.createNewsletter(task.payload);

      case 'compliance_check':
        return this.runComplianceCheck(task.payload);

      case 'publish_content':
        return this.publishContent(task.payload);

      case 'repurpose_content':
        return this.repurposeContent(task.payload);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Create a blog post outline.
   */
  async createOutline(payload: Record<string, unknown>): Promise<{ outlineId: string }> {
    const { topic, targetKeyword, contentBriefId, additionalContext } = payload;

    this.logger.info('Creating outline', { topic, targetKeyword });

    // Generate outline using Claude
    const outline = await this.claude.generateOutline(
      topic as string,
      targetKeyword as string,
      additionalContext as string | undefined
    );

    // Create content calendar entry
    const { data, error } = await this.supabase
      .from('content_calendar')
      .insert({
        content_type: 'blog_post',
        title: `Blog: ${topic}`,
        topic: topic as string,
        target_keyword: targetKeyword as string,
        outline,
        status: 'outline',
        content_brief_id: contentBriefId as string | undefined,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create content entry: ${error.message}`);
    }

    this.logger.info('Outline created', { contentId: data.id });

    // Submit for approval
    await this.submitForApproval({
      type: 'blog_post',
      title: `Blog Outline: ${topic}`,
      summary: `Outline for blog post about ${topic}`,
      content: { outline, topic, targetKeyword },
      contentId: data.id,
    });

    return { outlineId: data.id };
  }

  /**
   * Write a full blog post draft from an approved outline.
   */
  async writeDraft(payload: Record<string, unknown>): Promise<{ draftId: string }> {
    const { contentId } = payload;

    // Get the content entry with outline
    const { data: content, error: fetchError } = await this.supabase
      .from('content_calendar')
      .select('*')
      .eq('id', contentId)
      .single();

    if (fetchError || !content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    this.logger.info('Writing draft', { contentId, topic: content.topic });

    // Generate full draft
    const draft = await this.claude.generateBlogPost(
      content.outline,
      content.topic,
      content.target_keyword
    );

    // Run compliance check
    const compliance = await this.claude.checkCompliance(draft);

    // Update content entry
    const { error: updateError } = await this.supabase
      .from('content_calendar')
      .update({
        draft,
        status: compliance.passed ? 'draft' : 'review',
        metadata: {
          ...content.metadata,
          compliance_check: compliance,
        },
      })
      .eq('id', contentId);

    if (updateError) {
      throw new Error(`Failed to update content: ${updateError.message}`);
    }

    this.logger.info('Draft created', {
      contentId,
      compliancePassed: compliance.passed,
    });

    // Submit for approval
    await this.submitForApproval({
      type: 'blog_post',
      title: `Blog Draft: ${content.topic}`,
      summary: compliance.passed
        ? 'Draft ready for review'
        : `Draft needs review - ${compliance.issues.length} compliance issues`,
      content: {
        draft,
        topic: content.topic,
        targetKeyword: content.target_keyword,
        complianceCheck: compliance,
      },
      priority: compliance.passed ? 'medium' : 'high',
      contentId: contentId as string,
    });

    return { draftId: contentId as string };
  }

  /**
   * Create a LinkedIn post.
   */
  async createLinkedInPost(payload: Record<string, unknown>): Promise<{ postId: string }> {
    const { topic, keyPoints, tone, sourceContentId } = payload;

    this.logger.info('Creating LinkedIn post', { topic });

    // Generate LinkedIn post
    const post = await this.claude.generateLinkedInPost(
      topic as string,
      keyPoints as string[],
      (tone as 'educational' | 'thought-leadership' | 'personal') || 'educational'
    );

    // Run compliance check
    const compliance = await this.claude.checkCompliance(post);

    // Create content calendar entry
    const { data, error } = await this.supabase
      .from('content_calendar')
      .insert({
        content_type: 'linkedin_post',
        title: `LinkedIn: ${topic}`,
        topic: topic as string,
        draft: post,
        status: compliance.passed ? 'draft' : 'review',
        source_content_id: sourceContentId as string | undefined,
        metadata: { compliance_check: compliance },
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create content entry: ${error.message}`);
    }

    // Submit for approval
    await this.submitForApproval({
      type: 'linkedin_post',
      title: `LinkedIn Post: ${topic}`,
      summary: `LinkedIn post for review`,
      content: { post, topic, complianceCheck: compliance },
      contentId: data.id,
    });

    return { postId: data.id };
  }

  /**
   * Create a newsletter.
   */
  async createNewsletter(payload: Record<string, unknown>): Promise<{ newsletterId: string }> {
    const { month, theme, sections } = payload;

    this.logger.info('Creating newsletter', { month, theme });

    const newsletterSections: Record<string, string> = {};

    // Generate intro
    newsletterSections['intro'] = await this.claude.generateNewsletterSection('intro', {
      month,
      theme,
    });

    // Generate requested sections
    for (const section of (sections as { type: string; context: Record<string, unknown> }[]) || []) {
      const sectionContent = await this.claude.generateNewsletterSection(
        section.type as 'market-update' | 'featured-article' | 'tip' | 'intro',
        section.context
      );
      newsletterSections[section.type] = sectionContent;
    }

    // Combine into full newsletter
    const fullNewsletter = Object.entries(newsletterSections)
      .map(([key, value]) => `## ${key.replace(/-/g, ' ').toUpperCase()}\n\n${value}`)
      .join('\n\n---\n\n');

    // Run compliance check
    const compliance = await this.claude.checkCompliance(fullNewsletter);

    // Create content calendar entry
    const { data, error } = await this.supabase
      .from('content_calendar')
      .insert({
        content_type: 'newsletter',
        title: `Newsletter: ${month}`,
        topic: theme as string,
        draft: fullNewsletter,
        status: compliance.passed ? 'draft' : 'review',
        metadata: {
          month,
          theme,
          sections: newsletterSections,
          compliance_check: compliance,
        },
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create content entry: ${error.message}`);
    }

    // Submit for approval
    await this.submitForApproval({
      type: 'newsletter',
      title: `Newsletter: ${month}`,
      summary: `Monthly newsletter for ${month}`,
      content: { newsletter: fullNewsletter, sections: newsletterSections },
      contentId: data.id,
    });

    return { newsletterId: data.id };
  }

  /**
   * Run compliance check on content.
   */
  async runComplianceCheck(payload: Record<string, unknown>): Promise<{
    passed: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const { contentId, content } = payload;

    let textToCheck = content as string;

    // If contentId provided, fetch content
    if (contentId) {
      const { data } = await this.supabase
        .from('content_calendar')
        .select('draft, final_content')
        .eq('id', contentId)
        .single();

      if (data) {
        textToCheck = data.final_content || data.draft;
      }
    }

    if (!textToCheck) {
      throw new Error('No content to check');
    }

    const result = await this.claude.checkCompliance(textToCheck);

    // Update content metadata if contentId provided
    if (contentId) {
      await this.supabase
        .from('content_calendar')
        .update({
          metadata: { compliance_check: result, checked_at: new Date().toISOString() },
        })
        .eq('id', contentId);
    }

    return result;
  }

  /**
   * Publish approved content to WordPress.
   */
  async publishContent(payload: Record<string, unknown>): Promise<{ url: string }> {
    const { contentId } = payload;

    if (!this.wordpress) {
      throw new Error('WordPress client not configured');
    }

    // Get the approved content
    const { data: content, error } = await this.supabase
      .from('content_calendar')
      .select('*')
      .eq('id', contentId)
      .single();

    if (error || !content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    if (content.status !== 'approved') {
      throw new Error('Content must be approved before publishing');
    }

    const publishContent = content.final_content || content.draft;
    if (!publishContent) {
      throw new Error('No content to publish');
    }

    this.logger.info('Publishing content to WordPress', { contentId, title: content.title });

    // Get or create category
    let categoryIds: number[] = [];
    if (content.keywords && content.keywords.length > 0) {
      const category = await this.wordpress.getOrCreateCategory('Financial Planning');
      categoryIds = [category.id];
    }

    // Get or create tags
    let tagIds: number[] = [];
    if (content.keywords && content.keywords.length > 0) {
      const tags = await this.wordpress.getOrCreateTags(content.keywords);
      tagIds = tags.map((t) => t.id);
    }

    // Create WordPress post
    const wpPost = await this.wordpress.createPost({
      title: content.title.replace('Blog: ', ''),
      content: publishContent,
      excerpt: content.meta_description || undefined,
      status: 'publish',
      slug: this.wordpress.generateSlug(content.title),
      categories: categoryIds,
      tags: tagIds,
    });

    // Update content calendar entry
    await this.supabase
      .from('content_calendar')
      .update({
        status: 'published',
        published_url: wpPost.link,
        published_at: new Date().toISOString(),
        wordpress_post_id: wpPost.id,
      })
      .eq('id', contentId);

    this.logger.info('Content published', { contentId, url: wpPost.link });

    await this.logActivity({
      action: 'content_published',
      entityType: 'content_calendar',
      entityId: contentId as string,
      details: { url: wpPost.link, wordpressId: wpPost.id },
    });

    return { url: wpPost.link };
  }

  /**
   * Repurpose content into other formats.
   */
  async repurposeContent(payload: Record<string, unknown>): Promise<{ contentIds: string[] }> {
    const { sourceContentId, targetFormats } = payload;

    // Get source content
    const { data: source, error } = await this.supabase
      .from('content_calendar')
      .select('*')
      .eq('id', sourceContentId)
      .single();

    if (error || !source) {
      throw new Error(`Source content not found: ${sourceContentId}`);
    }

    const contentIds: string[] = [];
    const sourceContent = source.final_content || source.draft;

    for (const format of (targetFormats as string[]) || ['linkedin_post']) {
      if (format === 'linkedin_post') {
        // Extract key points from the source content
        const keyPoints = this.extractKeyPoints(sourceContent);

        const result = await this.createLinkedInPost({
          topic: source.topic,
          keyPoints,
          tone: 'educational',
          sourceContentId,
        });

        contentIds.push(result.postId);
      }
      // Add more formats as needed (twitter_thread, newsletter section, etc.)
    }

    return { contentIds };
  }

  /**
   * Check for content scheduled for publishing.
   */
  private async checkScheduledContent(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { data: scheduledContent, error } = await this.supabase
      .from('content_calendar')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_date', today);

    if (error || !scheduledContent || scheduledContent.length === 0) {
      return;
    }

    for (const content of scheduledContent) {
      this.logger.info('Publishing scheduled content', { contentId: content.id });

      try {
        await this.publishContent({ contentId: content.id });
      } catch (error) {
        this.logger.error(`Failed to publish scheduled content: ${content.id}`, error);
      }
    }
  }

  /**
   * Extract key points from content for repurposing.
   */
  private extractKeyPoints(content: string): string[] {
    // Simple extraction - look for headings and key sentences
    const lines = content.split('\n');
    const points: string[] = [];

    for (const line of lines) {
      // Extract H2 headings
      if (line.startsWith('## ')) {
        points.push(line.replace('## ', ''));
      }
      // Extract bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const point = line.replace(/^[-*]\s+/, '');
        if (point.length > 20 && point.length < 200) {
          points.push(point);
        }
      }
    }

    // Return top 5 points
    return points.slice(0, 5);
  }

  /**
   * Suggest topics based on SEO gaps and trends.
   */
  async suggestTopics(): Promise<{ topics: { topic: string; reason: string }[] }> {
    // Get content opportunities from SEO
    const { data: opportunities } = await this.supabase
      .from('content_opportunities')
      .select('*')
      .eq('status', 'identified')
      .order('search_volume', { ascending: false })
      .limit(5);

    const topics: { topic: string; reason: string }[] = [];

    for (const opp of opportunities || []) {
      topics.push({
        topic: opp.keyword,
        reason: `SEO opportunity: ${opp.search_volume} monthly searches, ${opp.current_gap}`,
      });
    }

    // Add evergreen topics if not enough from SEO
    const evergreenTopics = [
      { topic: 'Retirement Income Strategies', reason: 'Core service offering' },
      { topic: 'Understanding Fiduciary Duty', reason: 'Key differentiator' },
      { topic: 'Tax-Efficient Investing', reason: 'High-value topic' },
    ];

    while (topics.length < 5 && evergreenTopics.length > 0) {
      const topic = evergreenTopics.shift();
      if (topic) topics.push(topic);
    }

    return { topics };
  }
}
