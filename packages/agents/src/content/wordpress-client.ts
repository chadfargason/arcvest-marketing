// @ts-nocheck
/**
 * WordPress REST API Client
 *
 * Handles publishing content to WordPress.
 */

import { createLogger } from '@arcvest/shared';

const logger = createLogger('wordpress-client');

export interface WordPressConfig {
  url: string;
  username: string;
  appPassword: string;
}

export interface WordPressPost {
  id?: number;
  title: string;
  content: string;
  excerpt?: string;
  status: 'publish' | 'draft' | 'pending' | 'private';
  slug?: string;
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  meta?: Record<string, unknown>;
}

export interface WordPressPostResponse {
  id: number;
  link: string;
  status: string;
  title: { rendered: string };
  content: { rendered: string };
  slug: string;
  date: string;
  modified: string;
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WordPressTag {
  id: number;
  name: string;
  slug: string;
}

export class WordPressClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config?: Partial<WordPressConfig>) {
    const url = config?.url || process.env.WORDPRESS_URL;
    const username = config?.username || process.env.WORDPRESS_USERNAME;
    const appPassword = config?.appPassword || process.env.WORDPRESS_APP_PASSWORD;

    if (!url || !username || !appPassword) {
      throw new Error('WordPress URL, username, and app password are required');
    }

    this.baseUrl = url.replace(/\/$/, '');
    this.authHeader = 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');
  }

  /**
   * Make an authenticated request to the WordPress API.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/wp-json/wp/v2${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`WordPress API error: ${response.status}`, { error, endpoint });
      throw new Error(`WordPress API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Create a new post.
   */
  async createPost(post: WordPressPost): Promise<WordPressPostResponse> {
    logger.info('Creating WordPress post', { title: post.title });

    const response = await this.request<WordPressPostResponse>('/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        status: post.status,
        slug: post.slug,
        categories: post.categories,
        tags: post.tags,
        featured_media: post.featured_media,
        meta: post.meta,
      }),
    });

    logger.info('WordPress post created', { id: response.id, link: response.link });
    return response;
  }

  /**
   * Update an existing post.
   */
  async updatePost(id: number, post: Partial<WordPressPost>): Promise<WordPressPostResponse> {
    logger.info('Updating WordPress post', { id });

    const response = await this.request<WordPressPostResponse>(`/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(post),
    });

    logger.info('WordPress post updated', { id: response.id });
    return response;
  }

  /**
   * Get a post by ID.
   */
  async getPost(id: number): Promise<WordPressPostResponse> {
    return this.request<WordPressPostResponse>(`/posts/${id}`);
  }

  /**
   * Get posts with optional filters.
   */
  async getPosts(params?: {
    status?: string;
    per_page?: number;
    page?: number;
    search?: string;
    categories?: number[];
  }): Promise<WordPressPostResponse[]> {
    const searchParams = new URLSearchParams();

    if (params?.status) searchParams.set('status', params.status);
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.categories) searchParams.set('categories', params.categories.join(','));

    const query = searchParams.toString();
    return this.request<WordPressPostResponse[]>(`/posts${query ? '?' + query : ''}`);
  }

  /**
   * Delete a post.
   */
  async deletePost(id: number, force: boolean = false): Promise<void> {
    logger.info('Deleting WordPress post', { id, force });

    await this.request(`/posts/${id}?force=${force}`, {
      method: 'DELETE',
    });

    logger.info('WordPress post deleted', { id });
  }

  /**
   * Get all categories.
   */
  async getCategories(): Promise<WordPressCategory[]> {
    return this.request<WordPressCategory[]>('/categories?per_page=100');
  }

  /**
   * Create a category.
   */
  async createCategory(name: string, slug?: string): Promise<WordPressCategory> {
    return this.request<WordPressCategory>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
  }

  /**
   * Get or create a category by name.
   */
  async getOrCreateCategory(name: string): Promise<WordPressCategory> {
    const categories = await this.getCategories();
    const existing = categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      return existing;
    }

    return this.createCategory(name);
  }

  /**
   * Get all tags.
   */
  async getTags(): Promise<WordPressTag[]> {
    return this.request<WordPressTag[]>('/tags?per_page=100');
  }

  /**
   * Create a tag.
   */
  async createTag(name: string, slug?: string): Promise<WordPressTag> {
    return this.request<WordPressTag>('/tags', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
  }

  /**
   * Get or create tags by names.
   */
  async getOrCreateTags(names: string[]): Promise<WordPressTag[]> {
    const existingTags = await this.getTags();
    const result: WordPressTag[] = [];

    for (const name of names) {
      const existing = existingTags.find(
        (t) => t.name.toLowerCase() === name.toLowerCase()
      );

      if (existing) {
        result.push(existing);
      } else {
        const newTag = await this.createTag(name);
        result.push(newTag);
      }
    }

    return result;
  }

  /**
   * Upload media (image).
   */
  async uploadMedia(
    file: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ id: number; source_url: string }> {
    const url = `${this.baseUrl}/wp-json/wp/v2/media`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: file,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload media: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      source_url: data.source_url,
    };
  }

  /**
   * Generate SEO-friendly slug from title.
   */
  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  }

  /**
   * Test the WordPress connection.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request('/users/me');
      logger.info('WordPress connection successful');
      return true;
    } catch (error) {
      logger.error('WordPress connection failed', error);
      return false;
    }
  }
}
