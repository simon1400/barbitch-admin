import { Axios } from '../../../lib/api';

export interface BlogTopic {
  id: number;
  documentId: string;
  title: string;
  description: string;
  keywords: string[];
  targetSlug: string;
  scheduledDate: string;
  stage: 'proposed' | 'approved' | 'rejected' | 'generating' | 'generated' | 'published';
  internalLinks: string[];
  blog?: { id: number; documentId: string; title: string; slug: string };
}

export interface BlogPlan {
  id: number;
  documentId: string;
  month: number;
  year: number;
  stage: 'draft' | 'approved' | 'completed';
  topics: BlogTopic[];
}

// Fetch all plans with their topics
export async function fetchPlans(): Promise<BlogPlan[]> {
  try {
    const plans = await Axios.get(
      '/api/blog-plans?sort=year:desc,month:desc&populate[topics][populate][blog][fields][0]=title&populate[topics][populate][blog][fields][1]=slug'
    ) as unknown as BlogPlan[];
    return plans || [];
  } catch {
    return [];
  }
}

// Fetch single plan with topics
export async function fetchPlan(documentId: string): Promise<BlogPlan | null> {
  try {
    const plan = await Axios.get(
      `/api/blog-plans/${documentId}?populate[topics][populate][blog][fields][0]=title&populate[topics][populate][blog][fields][1]=slug`
    ) as unknown as BlogPlan;
    return plan || null;
  } catch {
    return null;
  }
}

// Generate new plan
export async function generatePlan(month: number, year: number) {
  return Axios.post('/api/blog-ai/generate-plan', { month, year }) as unknown as { plan: BlogPlan; topics: BlogTopic[] };
}

// Generate article for a topic
export async function generateArticle(topicId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Axios.post(`/api/blog-ai/generate-article/${topicId}`, {}, { timeout: 300000 }) as unknown as { blogPost: any; article: any };
}

// Approve topic
export async function approveTopic(topicId: string) {
  return Axios.put(`/api/blog-ai/topics/${topicId}/approve`) as unknown as BlogTopic;
}

// Reject topic
export async function rejectTopic(topicId: string) {
  return Axios.put(`/api/blog-ai/topics/${topicId}/reject`) as unknown as BlogTopic;
}

// Update topic
export async function updateTopic(
  topicId: string,
  data: Partial<Pick<BlogTopic, 'title' | 'description' | 'keywords' | 'targetSlug' | 'scheduledDate'>>
) {
  return Axios.put(`/api/blog-ai/topics/${topicId}/update`, data) as unknown as BlogTopic;
}

// Delete plan with all topics
export async function deletePlan(planId: string): Promise<void> {
  await Axios.delete(`/api/blog-ai/plans/${planId}`);
}

// Month names in Czech
export const MONTH_NAMES = [
  '', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

// Status labels and colors
export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  proposed: { label: 'Navrženo', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  approved: { label: 'Schváleno', color: 'text-blue-700', bg: 'bg-blue-100' },
  rejected: { label: 'Zamítnuto', color: 'text-red-700', bg: 'bg-red-100' },
  generating: { label: 'Generuje se...', color: 'text-purple-700', bg: 'bg-purple-100' },
  generated: { label: 'Vygenerováno', color: 'text-green-700', bg: 'bg-green-100' },
  published: { label: 'Publikováno', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  draft: { label: 'Koncept', color: 'text-gray-700', bg: 'bg-gray-100' },
  completed: { label: 'Dokončeno', color: 'text-green-700', bg: 'bg-green-100' },
};
