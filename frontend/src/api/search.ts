import { http } from './client';

export interface SearchHit {
  type: 'task' | 'project' | 'comment';
  id: string;
  title: string;
  snippet: string | null;
  status?: string | null;
  projectName?: string | null;
  url: string;
  updatedAt: string;
}

export interface SearchResults {
  tasks: SearchHit[];
  projects: SearchHit[];
  comments: SearchHit[];
}

export const searchApi = {
  search: (q: string) => http.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`),
};
