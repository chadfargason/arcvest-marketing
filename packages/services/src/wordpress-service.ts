import { getSupabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * WordPress Service
 *
 * Handles integration with WordPress REST API
 * for publishing and managing blog content.
 *
 * Requires:
 * 1. WordPress site with REST API enabled
 * 2. Application password for authentication
 * 3. User with publishing permissions
 */

export interface WordPressConfig {
  url: string;
  username: string;
  applicationPassword: string;
}

export interface WordPressPost {
  id?: number;
  title: string;
  content: string;
  status: 'draft' | 'pending' | 'publish' | 'future' | 'private';
  date?: string;
  slug?: string;
  excerpt?: string;
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  meta?: Record<string, string>;
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export class WordPressService {
  private supabase: SupabaseClient;
  private config: WordPressConfig | null = null;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
  }

  /**
   * Initialize the service with WordPress credentials
   */
  async initialize(config: WordPressConfig): Promise<void> {
    this.config = config;
    // Validate by testing connection
    if (config.url && config.username && config.applicationPassword) {
      try {
        await this.testConnection();
      } catch (error) {
        console.warn('WordPress connection test failed:', error);
      }
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.config !== null &&
      !!this.config.url &&
      !!this.config.username &&
      !!this.config.applicationPassword;
  }

  /**
   * Get the authorization header
   */
  private getAuthHeader(): string {
    if (!this.config) throw new Error('WordPress not configured');
    const credentials = Buffer.from(
      `${this.config.username}:${this.config.applicationPassword}`
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Make an authenticated request to WordPress
   */
  private async wpRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.config) throw new Error('WordPress not configured');

    const url = `${this.config.url}/wp-json/wp/v2${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    return response;
  }

  /**
   * Test the WordPress connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.wpRequest('/users/me');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all posts
   */
  async getPosts(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    search?: string;
  }): Promise<WordPressPost[]> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.per_page) queryParams.set('per_page', params.per_page.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.search) queryParams.set('search', params.search);

    const response = await this.wpRequest(`/posts?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }

    return response.json() as Promise<WordPressPost[]>;
  }

  /**
   * Get a single post
   */
  async getPost(id: number): Promise<WordPressPost> {
    const response = await this.wpRequest(`/posts/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch post: ${response.statusText}`);
    }

    return response.json() as Promise<WordPressPost>;
  }

  /**
   * Create a new post
   */
  async createPost(post: WordPressPost): Promise<WordPressPost> {
    const response = await this.wpRequest('/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: post.title,
        content: post.content,
        status: post.status || 'draft',
        date: post.date,
        slug: post.slug,
        excerpt: post.excerpt,
        categories: post.categories,
        tags: post.tags,
        featured_media: post.featured_media,
        meta: post.meta,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create post: ${error}`);
    }

    return response.json() as Promise<WordPressPost>;
  }

  /**
   * Update an existing post
   */
  async updatePost(id: number, post: Partial<WordPressPost>): Promise<WordPressPost> {
    const response = await this.wpRequest(`/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(post),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update post: ${error}`);
    }

    return response.json() as Promise<WordPressPost>;
  }

  /**
   * Delete a post
   */
  async deletePost(id: number, force = false): Promise<void> {
    const response = await this.wpRequest(`/posts/${id}?force=${force}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete post: ${response.statusText}`);
    }
  }

  /**
   * Get categories
   */
  async getCategories(): Promise<WordPressCategory[]> {
    const response = await this.wpRequest('/categories?per_page=100');
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }

    return response.json() as Promise<WordPressCategory[]>;
  }

  /**
   * Get tags
   */
  async getTags(): Promise<Array<{ id: number; name: string; slug: string }>> {
    const response = await this.wpRequest('/tags?per_page=100');
    if (!response.ok) {
      throw new Error(`Failed to fetch tags: ${response.statusText}`);
    }

    return response.json() as Promise<Array<{ id: number; name: string; slug: string }>>;
  }

  /**
   * Publish content from the content calendar
   */
  async publishFromCalendar(contentId: string): Promise<{
    wordpressPostId: number;
    url: string;
  }> {
    // Fetch content from content calendar
    const { data: content, error } = await this.supabase
      .from('content_calendar')
      .select('*')
      .eq('id', contentId)
      .single();

    if (error || !content) {
      throw new Error('Content not found in calendar');
    }

    if (!content.final_content && !content.draft) {
      throw new Error('No content to publish');
    }

    // Create WordPress post
    const post = await this.createPost({
      title: content.title || 'Untitled',
      content: content.final_content || content.draft,
      status: 'publish',
      excerpt: content.meta_description,
    });

    // Update content calendar with WordPress post ID
    await this.supabase
      .from('content_calendar')
      .update({
        wordpress_post_id: post.id,
        published_url: `${this.config?.url}/?p=${post.id}`,
        published_at: new Date().toISOString(),
        status: 'published',
      })
      .eq('id', contentId);

    return {
      wordpressPostId: post.id!,
      url: `${this.config?.url}/?p=${post.id}`,
    };
  }

  /**
   * Schedule a post for future publication
   */
  async schedulePost(
    post: WordPressPost,
    publishDate: Date
  ): Promise<WordPressPost> {
    return this.createPost({
      ...post,
      status: 'future',
      date: publishDate.toISOString(),
    });
  }
}

// Singleton instance
let serviceInstance: WordPressService | null = null;

export function getWordPressService(): WordPressService {
  if (!serviceInstance) {
    serviceInstance = new WordPressService();
  }
  return serviceInstance;
}
