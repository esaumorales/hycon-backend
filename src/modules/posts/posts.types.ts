export interface PublicacionBase {
  postId: number;
  authorId: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverUrl: string | null;
  status: string;
  views: number;
  publishedAt: Date;
  createdAt: Date;
  author: { name: string; lastname: string };
}

// Forma que se expone por la API
export interface PublicacionPublica {
  postId: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverUrl: string | null;
  status: string;
  views: number;
  readingMinutes: number;
  authorName: string;
  publishedAt: string;
  createdAt: string;
}
