import type {Project} from '@merlin/db';
import useSWR from 'swr';

export type DashboardProject = Omit<Project, 'secret'> & {secret: string | null};

/**
 * Fetch all projects for the current user
 */
export function useProjects() {
  return useSWR<DashboardProject[]>('/users/@me/projects', {shouldRetryOnError: false});
}
