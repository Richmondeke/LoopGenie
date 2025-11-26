
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Project, ProjectStatus } from '../types';

// --- Types ---
// Map DB row to Project type
const mapRowToProject = (row: any): Project => {
  let pType = row.project_type;

  // Robust fallback: Infer type from ID if column is missing or null
  // This ensures the app works even if the user hasn't run the latest migration
  if (!pType) {
    if (row.id && String(row.id).startsWith('ugc_')) {
      pType = 'UGC_PRODUCT';
    } else {
      pType = 'AVATAR';
    }
  }

  return {
    id: row.id,
    templateId: row.template_id || 'unknown',
    templateName: row.template_name || 'Untitled Project',
    thumbnailUrl: row.thumbnail_url || '',
    status: row.status as ProjectStatus,
    videoUrl: row.video_url,
    error: row.error,
    createdAt: row.created_at || Date.now(),
    type: pType as 'AVATAR' | 'UGC_PRODUCT'
  };
};

// --- Mock/Local Implementation ---
const PROJECT_STORAGE_KEY = 'loopgenie_projects';

const getLocalProjects = (): any[] => {
  const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveLocalProjects = (projects: any[]) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
};

// --- Service Methods ---

export const fetchProjects = async (): Promise<Project[]> => {
  if (!isSupabaseConfigured()) {
    const localData = getLocalProjects();
    return localData.map(mapRowToProject);
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
  return data.map(mapRowToProject);
};

export const deductCredits = async (userId: string, amount: number): Promise<void> => {
    if (!isSupabaseConfigured()) return; // Mock mode assumes infinite or handled locally

    // Fetch current
    const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', userId)
        .single();
    
    if (fetchError || !profile) {
        // Fallback if profile doesn't exist yet (auto-creation delay)
        return; 
    }

    if (profile.credits_balance < amount) {
        throw new Error("Insufficient credits");
    }

    // Deduct
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits_balance: profile.credits_balance - amount })
        .eq('id', userId);

    if (updateError) throw updateError;
};

export const saveProject = async (project: Project) => {
  if (!isSupabaseConfigured()) {
    const projects = getLocalProjects();
    // Check if exists
    const index = projects.findIndex((p: any) => p.id === project.id);
    const row = {
      id: project.id,
      template_id: project.templateId,
      template_name: project.templateName,
      thumbnail_url: project.thumbnailUrl,
      status: project.status,
      video_url: project.videoUrl,
      error: project.error,
      created_at: project.createdAt,
      project_type: project.type
    };

    if (index >= 0) {
      projects[index] = { ...projects[index], ...row };
    } else {
      projects.unshift(row);
    }
    saveLocalProjects(projects);
    return;
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) {
      throw new Error("User must be logged in to save a project.");
  }

  // Ensure template_id is never null
  const templateIdSafe = project.templateId || 'unknown_template';

  const payload = {
      id: project.id,
      user_id: user.data.user.id,
      template_id: templateIdSafe, 
      template_name: project.templateName || 'Untitled',
      thumbnail_url: project.thumbnailUrl,
      status: project.status,
      video_url: project.videoUrl,
      error: project.error,
      created_at: project.createdAt,
      project_type: project.type || 'AVATAR'
  };

  const { error } = await supabase
    .from('projects')
    .upsert(payload);

  if (error) {
    // Graceful fallback for schema mismatch (PGRST204 or specific message)
    if (error.code === 'PGRST204' || error.message?.includes('project_type')) {
       console.warn("Schema mismatch detected: 'project_type' column missing in DB. Saving without it.");
       
       // Remove the problematic column and retry
       const { project_type, ...fallbackPayload } = payload;
       
       const retry = await supabase.from('projects').upsert(fallbackPayload);
       
       if (retry.error) {
          console.error('Error saving project (retry failed):', retry.error);
          throw new Error(`Database Error: ${retry.error.message || JSON.stringify(retry.error)}`);
       }
       return;
    }

    console.error('Error saving project:', error);
    // Throw a readable error message
    throw new Error(`Database Error: ${error.message || JSON.stringify(error)}`);
  }
};

export const updateProjectStatus = async (id: string, updates: Partial<Project>) => {
  if (!isSupabaseConfigured()) {
    const projects = getLocalProjects();
    const index = projects.findIndex((p: any) => p.id === id);
    if (index >= 0) {
      if (updates.status) projects[index].status = updates.status;
      if (updates.videoUrl) projects[index].video_url = updates.videoUrl;
      if (updates.thumbnailUrl) projects[index].thumbnail_url = updates.thumbnailUrl;
      if (updates.error) projects[index].error = updates.error;
      saveLocalProjects(projects);
    }
    return;
  }

  // Only update fields that exist in the DB schema
  const dbUpdates: any = {};
  if (updates.status) dbUpdates.status = updates.status;
  if (updates.videoUrl) dbUpdates.video_url = updates.videoUrl;
  if (updates.thumbnailUrl) dbUpdates.thumbnail_url = updates.thumbnailUrl;
  if (updates.error) dbUpdates.error = updates.error;

  const { error } = await supabase
    .from('projects')
    .update(dbUpdates)
    .eq('id', id);

  if (error) console.error('Error updating project:', error);
};
