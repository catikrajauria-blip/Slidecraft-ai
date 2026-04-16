/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Layout, 
  History, 
  MessageSquare, 
  Upload, 
  FileText, 
  Sparkles,
  ChevronRight,
  Settings,
  LogOut,
  User,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Toaster, toast } from 'sonner';
import { AISuggestions } from '@/components/AISuggestions';
import { parsePptx } from '@/lib/pptx-parser';
import { enhancePresentation, chatWithPresentation, EnhancedSlide } from '@/services/gemini';
import { exportToPptx } from '@/lib/pptx-exporter';
import { Project, ChatMessage } from '@/types';
import { auth, signInWithGoogle, signOut, onAuthStateChanged, User as FirebaseUser } from '@/lib/firebase';
import { saveProjectToFirestore, subscribeToProjects, saveUserProfile, deleteProjectFromFirestore } from '@/lib/firestore-service';


export default function App() {
  return (
    <SlideCraftApp />
  );
}

function SlideCraftApp() {
  const [activeTab, setActiveTab] = useState('create');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Handle Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        saveUserProfile(currentUser).catch(err => {
          console.error("Failed to save user profile:", err);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Projects with Firestore
  useEffect(() => {
    if (user) {
      try {
        const unsubscribe = subscribeToProjects((updatedProjects) => {
          setProjects(updatedProjects);
        });
        return () => unsubscribe();
      } catch (err) {
        console.error("Failed to subscribe to projects:", err);
        toast.error("Cloud sync failed. Check console for details.");
      }
    } else {
      setProjects([]);
    }
  }, [user]);

  const handleSaveProject = async (project: Project) => {
    if (!user) {
      toast.error("Please sign in to save your project.");
      return;
    }
    try {
      await saveProjectToFirestore(project);
    } catch (error) {
      toast.error("Failed to save project to cloud.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error("Please sign in to create a project.");
      e.target.value = '';
      return;
    }

    setIsProcessing(true);
    toast.info("Reading presentation file...");

    try {
      const slides = await parsePptx(file);
      
      if (slides.length === 0) {
        toast.error("No readable text found in the presentation. Try another file.");
        setIsProcessing(false);
        e.target.value = '';
        return;
      }

      const fullText = slides.map(s => s.text.join(' ')).join('\n\n');
      
      toast.info("AI is enhancing your slides...");
      const enhancedSlides = await enhancePresentation(fullText);
      
      if (enhancedSlides.length === 0) {
        throw new Error("AI failed to generate enhanced slides.");
      }
      
      const newProject: Project = {
        id: window.crypto?.randomUUID?.() || Math.random().toString(36).substring(2),
        name: file.name.replace('.pptx', ''),
        createdAt: Date.now(),
        slides: enhancedSlides,
        originalText: fullText
      };

      setCurrentProject(newProject);
      await handleSaveProject(newProject);
      setActiveTab('editor');
      toast.success("Presentation enhanced successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      const message = error instanceof Error ? error.message : "Failed to process presentation.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    try {
      const history = chatMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      
      const response = await chatWithPresentation(history, chatInput);
      const aiMsg: ChatMessage = { role: 'model', content: response };
      setChatMessages(prev => [...prev, aiMsg]);

      // If the AI suggests a design change, we could potentially trigger a re-enhancement
      if (chatInput.toLowerCase().includes('change') || chatInput.toLowerCase().includes('improve') || chatInput.toLowerCase().includes('make')) {
        toast.info("Updating presentation based on your feedback...");
        const updatedSlides = await enhancePresentation(currentProject?.originalText || '', chatInput);
        if (currentProject) {
          const updatedProject = { ...currentProject, slides: updatedSlides };
          setCurrentProject(updatedProject);
          await handleSaveProject(updatedProject);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to get AI response.");
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteProjectFromFirestore(id);
      toast.success("Project deleted.");
      if (currentProject?.id === id) {
        setCurrentProject(null);
        setActiveTab('create');
      }
    } catch (error) {
      toast.error("Failed to delete project.");
    }
  };

  const handleExport = async () => {
    if (!currentProject) return;
    toast.info("Preparing export...");
    try {
      await exportToPptx(currentProject);
      toast.success("Presentation exported!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export presentation.");
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/30 selection:text-accent">
      <Toaster position="top-center" />
      
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 bottom-0 w-20 bg-background border-r border-border z-50 flex flex-col items-center py-8 gap-12">
        <div className="flex items-center justify-center">
          <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center neon-glow">
            <Sparkles className="text-background w-6 h-6" />
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-12">
          <button 
            className={`vertical-text text-[11px] tracking-[0.2em] uppercase transition-colors ${activeTab === 'create' ? 'text-accent font-bold' : 'text-foreground/40 hover:text-foreground'}`}
            onClick={() => setActiveTab('create')}
          >
            Workspace
          </button>
          <button 
            className={`vertical-text text-[11px] tracking-[0.2em] uppercase transition-colors ${activeTab === 'projects' ? 'text-accent font-bold' : 'text-foreground/40 hover:text-foreground'}`}
            onClick={() => setActiveTab('projects')}
          >
            Artifacts
          </button>
          <button 
            className={`vertical-text text-[11px] tracking-[0.2em] uppercase transition-colors ${activeTab === 'editor' ? 'text-accent font-bold' : 'text-foreground/40 hover:text-foreground'}`}
            disabled={!currentProject}
            onClick={() => setActiveTab('editor')}
          >
            Editor
          </button>
        </nav>

        <div className="mt-auto flex flex-col items-center gap-6">
          {user ? (
            <button onClick={signOut} className="group relative">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-border group-hover:border-accent transition-colors">
                {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-accent" />}
              </div>
              <div className="absolute left-full ml-4 bg-surface border border-border p-2 rounded hidden group-hover:block whitespace-nowrap text-[10px] uppercase tracking-wider z-50">
                Sign Out
              </div>
            </button>
          ) : (
            <button onClick={signInWithGoogle} className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:border-accent transition-colors">
              <User className="w-5 h-5 text-foreground/40" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="pl-20 min-h-screen flex flex-col">
        <header className="h-20 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-display text-accent tracking-tighter">V.</h2>
            <div className="h-4 w-[1px] bg-border mx-2" />
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-foreground/40">
              <span>Artifacts</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-bold">{currentProject?.name || 'Untitled'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right mr-4 hidden md:block">
              <p className="text-[10px] text-foreground/30 leading-none mb-1">DESIGN ENGINE V4.2</p>
              <p className="text-[11px] font-bold tracking-wider">AUTONOMOUS MODE ON</p>
            </div>
            <Button variant="outline" size="sm" className="border-border hover:border-accent hover:text-accent bg-transparent text-[10px] uppercase tracking-widest h-9 px-4">
              <Settings className="w-3 h-3 mr-2" /> Settings
            </Button>
            <Button 
              size="sm" 
              className="bg-accent hover:bg-accent/90 text-background font-bold text-[10px] uppercase tracking-widest h-9 px-6 neon-glow"
              onClick={handleExport}
              disabled={!currentProject}
            >
              Export Artifact
            </Button>
          </div>
        </header>

        <div className="flex-1 p-10">
          <AnimatePresence mode="wait">
            {activeTab === 'create' && (
              <motion.div 
                key="create"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-5xl mx-auto"
              >
                <div className="mb-16">
                  <h1 className="text-[120px] leading-[0.85] mb-6">
                    GENERATE<br />
                    <span className="text-accent">BEYOND</span> STATIC
                  </h1>
                  <p className="text-foreground/40 text-sm uppercase tracking-[0.2em] max-w-md">
                    AI will extract & re-articulate your presentation automatically using autonomous design parameters.
                  </p>
                </div>

                <Card className="border border-dashed border-foreground/20 cyber-gradient p-20 flex flex-col items-center justify-center text-center hover:border-accent transition-colors cursor-pointer relative group overflow-hidden rounded-3xl">
                  <div className="absolute inset-0 opacity-05 pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--color-accent) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                  <input 
                    type="file" 
                    accept=".pptx" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                  />
                  <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform neon-glow">
                    <Upload className="text-accent w-10 h-10" />
                  </div>
                  <h2 className="text-4xl tracking-widest mb-4">DROP PPTX FILE</h2>
                  <p className="text-foreground/30 text-xs uppercase tracking-widest">Maximum file size 25MB • Autonomous extraction active</p>
                  {isProcessing && (
                    <div className="mt-8 flex items-center gap-3 text-accent font-bold uppercase tracking-widest text-xs">
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Re-articulating design...
                    </div>
                  )}
                </Card>

                <div className="mt-16 grid grid-cols-3 gap-10">
                  <div className="space-y-4">
                    <div className="w-12 h-12 border border-border flex items-center justify-center rounded-lg">
                      <Sparkles className="text-accent w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-widest">Neural Enhancement</h4>
                    <p className="text-[11px] text-foreground/40 leading-relaxed">Advanced LLM-driven content synthesis and visual hierarchy optimization.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="w-12 h-12 border border-border flex items-center justify-center rounded-lg">
                      <Layout className="text-accent w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-widest">Cyber-Editorial</h4>
                    <p className="text-[11px] text-foreground/40 leading-relaxed">Brutalist layout patterns combined with high-contrast neon aesthetics.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="w-12 h-12 border border-border flex items-center justify-center rounded-lg">
                      <MessageSquare className="text-accent w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-widest">Direct Interface</h4>
                    <p className="text-[11px] text-foreground/40 leading-relaxed">Natural language control over visual weight, typography, and motion parameters.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'projects' && (
              <motion.div 
                key="projects"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-6xl mx-auto"
              >
                <div className="flex items-center gap-4 mb-10">
                  <h3 className="text-xl tracking-[0.2em]">RECENT ARTIFACTS</h3>
                  <Badge className="bg-accent text-background font-black text-[10px] rounded-sm neon-glow">NEW</Badge>
                </div>

                {projects.length === 0 ? (
                  <div className="text-center py-32 border border-dashed border-border rounded-3xl">
                    <FileText className="w-16 h-16 text-foreground/10 mx-auto mb-6" />
                    <h3 className="text-2xl font-display text-foreground/20 tracking-widest">NO ARTIFACTS FOUND</h3>
                    <Button variant="link" className="text-accent uppercase tracking-widest text-xs mt-4" onClick={() => setActiveTab('create')}>Initialize first build</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {projects.map(project => (
                      <Card key={project.id} className="bg-surface border-border overflow-hidden hover:border-accent transition-all cursor-pointer group relative" onClick={() => {
                        setCurrentProject(project);
                        setActiveTab('editor');
                      }}>
                        <div className="h-48 bg-background flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 opacity-05" style={{ backgroundImage: 'radial-gradient(var(--color-accent) 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
                          <FileText className="w-16 h-16 text-foreground/5 group-hover:text-accent/10 transition-colors" />
                          <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button size="sm" className="bg-accent text-background font-bold uppercase tracking-widest text-[10px] h-8 px-4">Open Artifact</Button>
                          </div>
                        </div>
                        <div className="p-6">
                          <div className="project-meta text-[10px] uppercase tracking-widest text-accent mb-3">
                            {new Date(project.createdAt).toLocaleDateString()} • {project.slides.length} SLIDES
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <h4 className="text-lg font-bold tracking-tight truncate flex-1">{project.name}</h4>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-foreground/20 hover:text-red-500 hover:bg-red-500/10"
                              onClick={(e) => handleDeleteProject(project.id, e)}
                            >
                              <Plus className="w-4 h-4 rotate-45" />
                            </Button>
                          </div>
                          <div className="h-[2px] w-10 bg-accent mt-4 group-hover:w-full transition-all duration-500" />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'editor' && currentProject && (
              <motion.div 
                key="editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex gap-10 h-[calc(100vh-14rem)]"
              >
                {/* Slide Preview */}
                <div className="flex-1 flex flex-col gap-8 overflow-hidden">
                  <ScrollArea className="flex-1 rounded-3xl border border-border bg-surface p-10 shadow-2xl">
                    <div className="space-y-20 max-w-3xl mx-auto">
                      {currentProject.slides.map((slide, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          className="relative group"
                        >
                          <div className="absolute -left-16 top-0 text-accent/20 font-display text-4xl">{String(idx + 1).padStart(2, '0')}</div>
                          <Card 
                            className="p-16 min-h-[500px] flex flex-col justify-center shadow-none border-border overflow-hidden relative rounded-2xl"
                            style={{ 
                              backgroundColor: slide.theme.secondaryColor,
                              color: slide.theme.primaryColor,
                              fontFamily: slide.theme.fontFamily
                            }}
                          >
                            <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-bl-full -mr-24 -mt-24" />
                            <h3 className="text-6xl font-display mb-10 leading-[0.9] tracking-tighter">{slide.title}</h3>
                            <p className="text-2xl opacity-90 leading-relaxed whitespace-pre-wrap font-light">{slide.content}</p>
                            <div className="mt-16 flex items-center gap-4">
                              <Badge variant="outline" className="border-current opacity-50 text-[10px] uppercase tracking-widest px-3 py-1">{slide.animationType}</Badge>
                              <span className="text-[10px] uppercase tracking-widest opacity-40 italic">{slide.visualSuggestion}</span>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Chat Panel */}
                <div className="w-96 flex flex-col gap-6">
                  <AISuggestions onApply={(suggestion) => {
                    setChatInput(suggestion);
                    const event = { preventDefault: () => {} } as React.FormEvent;
                    handleChat(event);
                  }} />
                  
                  <Card className="flex-1 flex flex-col overflow-hidden bg-surface border-border rounded-2xl">
                    <div className="p-5 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-accent rounded-full neon-glow animate-pulse" />
                        <h4 className="font-bold text-[11px] uppercase tracking-[0.2em]">Design Intelligence</h4>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-border text-foreground/40">ACTIVE</Badge>
                    </div>
                    <ScrollArea className="flex-1 p-6">
                      <div className="space-y-6">
                        <div className="bg-accent/5 border-l-2 border-accent p-4 text-xs leading-relaxed text-accent">
                          Design parameters initialized. I've analyzed the semantic structure of your presentation. Ready for visual weight adjustments or theme re-articulation.
                        </div>
                        {chatMessages.map((msg, i) => (
                          <div 
                            key={i} 
                            className={`p-4 rounded-xl text-xs leading-relaxed ${
                              msg.role === 'user' 
                                ? 'bg-foreground/5 text-foreground/60 ml-8 border border-border' 
                                : 'bg-accent/5 text-accent mr-8 border-l-2 border-accent'
                            }`}
                          >
                            {msg.content}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <form onSubmit={handleChat} className="p-5 border-t border-border bg-background/50">
                      <div className="relative">
                        <Input 
                          placeholder="INPUT PARAMETERS..." 
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          className="bg-background border-border focus-visible:ring-accent text-[11px] h-12 pr-12 tracking-wider uppercase"
                        />
                        <Button type="submit" size="icon" className="absolute right-1 top-1 bottom-1 bg-accent hover:bg-accent/90 text-background h-10 w-10 rounded-lg neon-glow">
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </div>
                    </form>
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
