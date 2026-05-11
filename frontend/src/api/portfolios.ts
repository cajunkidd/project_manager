import { http } from './client';

export interface PortfolioProjectLink {
  id: string;
  portfolioId: string;
  projectId: string;
  sortOrder: number;
  createdAt: string;
  project: {
    id: string;
    name: string;
    status: string;
    priority: string;
    dueDate: string | null;
    completedAt: string | null;
  };
}

export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; displayName: string; email: string } | null;
  projects: PortfolioProjectLink[];
}

export interface PortfolioSummary {
  portfolio: { id: string; name: string };
  projectCount: number;
  projectsByStatus: Record<string, number>;
  taskCount: number;
  completedTasks: number;
  overdueTasks: number;
  completionPct: number;
  minutesLogged: number;
}

export interface CreatePortfolioInput {
  name: string;
  description?: string | null;
  color?: string | null;
  ownerId?: string | null;
  projectIds?: string[];
}

export const portfoliosApi = {
  list: () => http.get<Portfolio[]>('/portfolios'),
  get: (id: string) => http.get<Portfolio>(`/portfolios/${id}`),
  summary: (id: string) => http.get<PortfolioSummary>(`/portfolios/${id}/summary`),
  create: (input: CreatePortfolioInput) => http.post<Portfolio>('/portfolios', input),
  update: (id: string, input: Partial<CreatePortfolioInput>) =>
    http.patch<Portfolio>(`/portfolios/${id}`, input),
  remove: (id: string) => http.delete(`/portfolios/${id}`),
  addProject: (portfolioId: string, projectId: string) =>
    http.post<PortfolioProjectLink>(`/portfolios/${portfolioId}/projects`, { projectId }),
  removeProject: (portfolioId: string, projectId: string) =>
    http.delete(`/portfolios/${portfolioId}/projects/${projectId}`),
};
