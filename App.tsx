
import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TemplateGallery } from './components/TemplateGallery';
import { Editor } from './components/Editor';
import { ProjectList } from './components/ProjectList';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { AppView, Template, Project, ProjectStatus } from './types';
import { generateVideo, checkVideoStatus } from './services/heygenService';
import { fetchProjects, saveProject, updateProjectStatus, deductCredits, refundCredits } from './services/projectService';
import { signOut, getSession, onAuthStateChange, getUserProfile } from './services/authService';
import { Menu, Loader2 } from 'lucide-react';
import { DEFAULT_HEYGEN_API_KEY } from './constants';

// Persist keys in localStorage for convenience
const STORAGE_KEY_HEYGEN = 'genavatar_heygen_key';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userCredits, setUserCredits] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentView, setCurrentView] = useState<AppView>(AppView.TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  // Track which view of the gallery to show when returning (Dashboard vs Avatar List)
  const [galleryInitialView, setGalleryInitialView] = useState<'DASHBOARD' | 'AVATAR_SELECT'>('DASHBOARD');

  const [projects, setProjects] = useState<Project[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // API Keys State
  const [heyGenKey, setHeyGenKey] = useState(localStorage.getItem(STORAGE_KEY_HEYGEN) || DEFAULT_HEYGEN_API_KEY);
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);

  // Load User Profile (Credits)
  const loadProfile = async (userId: string) => {
      const profile = await getUserProfile(userId);
      if (profile) {
          setUserCredits(profile.credits_balance);
      }
  };

  // Auth Effect
  useEffect(() => {
    // Check initial session
    getSession().then(({ data }) => {
        setSession(data.session);
        if (data.session?.user) {
            loadProfile(data.session.user.id);
        }
        setAuthLoading(false);
    }).catch(() => setAuthLoading(false));

    // Subscribe to changes
    const { data } = onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      }
      setAuthLoading(false);
    });

    return () => {
        if (data && data.subscription) {
            data.subscription.unsubscribe();
        }
    };
  }, []);

  // Fetch Projects Effect
  useEffect(() => {
    if (session) {
      fetchProjects().then(setProjects);
    }
  }, [session]);

  // Persist keys effect
  useEffect(() => {
    if (heyGenKey) {
        localStorage.setItem(STORAGE_KEY_HEYGEN, heyGenKey);
    }
  }, [heyGenKey]);

  // Polling Effect
  const pollStatuses = useCallback(async () => {
    if (!session) return;
    
    const activeProjects = projects.filter(p => p.status === ProjectStatus.PROCESSING || p.status === ProjectStatus.PENDING);
    if (activeProjects.length === 0) return;

    const updatedProjects = await Promise.all(activeProjects.map(async (project) => {
        // Only poll HeyGen projects (Avatar type)
        if (project.type === 'UGC_PRODUCT') return project;

        const result = await checkVideoStatus(heyGenKey, project.id);
        
        // Only update if changed or we have new data like URL
        if (result.status !== project.status || result.videoUrl) {
            // Update DB
            await updateProjectStatus(project.id, {
                status: result.status,
                videoUrl: result.videoUrl,
                thumbnailUrl: result.thumbnailUrl,
                error: result.error
            });

            return { 
                ...project, 
                status: result.status,
                videoUrl: result.videoUrl || project.videoUrl,
                thumbnailUrl: result.thumbnailUrl || project.thumbnailUrl,
                error: result.error
            };
        }
        return project;
    }));

    setProjects(prev => prev.map(p => {
        const updated = updatedProjects.find(up => up.id === p.id);
        return updated ? updated : p;
    }));
  }, [projects, heyGenKey, session]);

  // Set up polling interval
  useEffect(() => {
    const interval = setInterval(() => {
        pollStatuses();
    }, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [pollStatuses]);

  const handleSignOut = async () => {
      await signOut();
      setSession(null);
      setProjects([]);
      setCurrentView(AppView.TEMPLATES);
  };

  const handleSelectTemplate = (template: Template) => {
    // Determine return view based on template type
    if (template.mode === 'AVATAR') {
        setGalleryInitialView('AVATAR_SELECT');
    } else {
        setGalleryInitialView('DASHBOARD');
    }
    setSelectedTemplate(template);
  };

  const handleGenerate = async (data: any) => {
    if (!selectedTemplate || !session) return;
    
    // 1. Pre-check credits locally
    const cost = data.cost || 1;
    if (userCredits < cost) {
        alert("Insufficient credits to generate this video.");
        return;
    }

    try {
        setIsGenerating(true);

        // 2. Deduct Credits in DB
        // We do this BEFORE generation to prevent "free usage" if they close the tab
        // If generation fails, we will REFUND them in the catch block.
        const newBalance = await deductCredits(session.user.id, cost);
        
        // Update UI locally immediately
        setUserCredits(prev => Math.max(0, prev - cost));

        // 3. Generate Video
        let newProject: Project;

        // CASE A: Direct Save (Veo/UGC Product Videos)
        if (data.isDirectSave) {
            newProject = {
                id: `ugc_${Date.now()}`,
                templateId: selectedTemplate.id,
                templateName: selectedTemplate.name,
                thumbnailUrl: data.thumbnailUrl || 'https://via.placeholder.com/640x360?text=Product+UGC',
                videoUrl: data.videoUrl,
                status: ProjectStatus.COMPLETED,
                createdAt: Date.now(),
                type: 'UGC_PRODUCT',
                cost: cost
            };
        } else {
            // CASE B: Async Generation (HeyGen Avatar Videos)
            const jobId = await generateVideo(
                heyGenKey,
                selectedTemplate.id,
                data.variables,
                data.avatarId,
                data.voiceId
            );

            newProject = {
                id: jobId,
                templateId: selectedTemplate.id,
                templateName: selectedTemplate.name,
                thumbnailUrl: selectedTemplate.thumbnailUrl,
                status: ProjectStatus.PENDING,
                createdAt: Date.now(),
                type: 'AVATAR',
                cost: cost
            };
        }

        // 4. Save Project to DB
        await saveProject(newProject);
        setProjects(prev => [newProject, ...prev]);
        setSelectedTemplate(null);
        setCurrentView(AppView.PROJECTS);
        
        // 5. Re-sync credits from DB just to be sure
        loadProfile(session.user.id);

    } catch (error: any) {
        console.error("Generation failed:", error);
        
        // REFUND LOGIC
        // If we successfully deducted (or tried to), but generation failed, give it back.
        // We assume deductCredits succeeded if we reached here from the generating line.
        try {
            await refundCredits(session.user.id, cost);
            loadProfile(session.user.id); // Reload to show refunded amount
            console.log("Credits refunded due to generation failure.");
        } catch (refundError) {
            console.error("Failed to refund credits:", refundError);
        }

        alert(`Generation Failed: ${error.message || "Unknown error"}. \n\nCredits have been refunded.`);
    } finally {
        setIsGenerating(false);
    }
  };

  const renderContent = () => {
    if (selectedTemplate && currentView === AppView.TEMPLATES) {
        return (
            <Editor 
                template={selectedTemplate} 
                onBack={() => setSelectedTemplate(null)}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                heyGenKey={heyGenKey}
                userCredits={userCredits}
            />
        );
    }

    switch (currentView) {
      case AppView.TEMPLATES:
        return (
            <TemplateGallery 
                onSelectTemplate={handleSelectTemplate} 
                heyGenKey={heyGenKey} 
                initialView={galleryInitialView}
            />
        );
      case AppView.PROJECTS:
        return <ProjectList projects={projects} onPollStatus={pollStatuses} />;
      case AppView.SETTINGS:
        return (
            <Settings 
                heyGenKey={heyGenKey} 
                setHeyGenKey={setHeyGenKey} 
            />
        );
      case AppView.ASSETS:
        return <div className="flex items-center justify-center h-full text-gray-400">Assets Management (Coming Soon)</div>;
      case AppView.HELP:
        return <div className="flex items-center justify-center h-full text-gray-400">Documentation & Help (Coming Soon)</div>;
      default:
        return <TemplateGallery onSelectTemplate={handleSelectTemplate} heyGenKey={heyGenKey} />;
    }
  };

  if (authLoading) {
      return (
          <div className="h-screen flex items-center justify-center bg-gray-50">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
      );
  }

  if (!session) {
      return <Auth />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        currentView={currentView} 
        onChangeView={(view) => {
            setCurrentView(view);
            setSelectedTemplate(null);
            setIsMobileMenuOpen(false);
            // Reset gallery view when changing main tabs
            setGalleryInitialView('DASHBOARD');
        }}
        isMobileOpen={isMobileMenuOpen}
        toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onSignOut={handleSignOut}
        credits={userCredits}
      />

      <main className="flex-1 overflow-hidden flex flex-col relative">
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
             <div className="font-bold text-gray-900">LoopGenie</div>
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600">
                <Menu />
             </button>
        </header>
        <div className="flex-1 overflow-hidden p-6">
            {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
