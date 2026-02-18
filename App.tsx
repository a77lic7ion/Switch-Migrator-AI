
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Terminal as TerminalIcon, 
  Cpu, 
  RefreshCw, 
  Zap, 
  ShieldCheck, 
  Database,
  Clipboard,
  Upload,
  Download,
  LayoutGrid,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronRight,
  ListChecks,
  History,
  Activity,
  Box,
  FileCode,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  XCircle,
  Save,
  Trash2,
  Monitor,
  Search
} from 'lucide-react';
import { Header } from './components/Header';
import { StatusBadge } from './components/StatusBadge';
import { SettingsModal } from './components/SettingsModal';
import { SectionType, ConfigSection, TargetSpec, AppSettings, LogEntry, ConversionWarning, DeploymentStep, SavedSession, ConversionResult } from './types';
import { CiscoConfigParser } from './services/configParser';
import { GeminiConverter } from './services/geminiService';
import { MistralConverter } from './services/mistralService';
import { COMMON_MODELS, IOS_VERSIONS, SECTION_METADATA } from './constants';

const DEFAULT_SETTINGS: AppSettings = {
  activeProvider: 'google',
  activeModel: 'gemini-3-flash-preview',
  ollamaEndpoint: 'http://localhost:11434',
  mistralApiKey: '',
  mistralEndpoint: 'https://api.mistral.ai/v1',
  mistralModels: [],
  autoExecute: false,
  deepScan: true,
  terminalTheme: 'dark'
};

type BottomTab = 'LOG' | 'TERMINAL' | 'DIFF' | 'ADVISORY' | 'PLAN';
type RailView = 'ACTIVITY' | 'SESSIONS' | 'HISTORY';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('migrator_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
    return DEFAULT_SETTINGS;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sourceConfig, setSourceConfig] = useState('');
  const [targetConfig, setTargetConfig] = useState('');
  const [sections, setSections] = useState<ConfigSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [advisories, setAdvisories] = useState<(ConversionWarning & { sectionId: string; sectionName: string })[]>([]);
  const [activeAdvisoryIndex, setActiveAdvisoryIndex] = useState<number | null>(null);
  const [deploymentPlan, setDeploymentPlan] = useState<DeploymentStep[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>('LOG');
  const [railView, setRailView] = useState<RailView>('ACTIVITY');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [targetSpec, setTargetSpec] = useState<TargetSpec>({
    sourceModel: '',
    sourceIOS: '',
    model: COMMON_MODELS[1],
    targetIOS: IOS_VERSIONS[2]
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parser = new CiscoConfigParser();
  const geminiConverter = new GeminiConverter();

  useEffect(() => {
    const stored = localStorage.getItem('migrator_sessions');
    if (stored) setSavedSessions(JSON.parse(stored));
  }, []);

  const handleSettingsSave = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('migrator_settings', JSON.stringify(newSettings));
    addLog('INFO', `Platform Engine updated: ${newSettings.activeProvider.toUpperCase()} (${newSettings.activeModel})`);
  };

  const saveCurrentSession = () => {
    const newSession: SavedSession = {
      id: crypto.randomUUID(),
      name: `${targetSpec.model || 'New'} Migration - ${new Date().toLocaleTimeString()}`,
      timestamp: new Date().toISOString(),
      sourceConfig,
      targetConfig,
      targetSpec
    };
    const updated = [newSession, ...savedSessions];
    setSavedSessions(updated);
    localStorage.setItem('migrator_sessions', JSON.stringify(updated));
    addLog('SUCCESS', `Session archived to local storage.`);
  };

  const loadSession = (session: SavedSession) => {
    setSourceConfig(session.sourceConfig);
    setTargetConfig(session.targetConfig);
    setTargetSpec(session.targetSpec);
    processConfigString(session.sourceConfig, true);
    addLog('INFO', `Restored session from ${new Date(session.timestamp).toLocaleDateString()}`);
  };

  const deleteSession = (id: string) => {
    const updated = savedSessions.filter(s => s.id !== id);
    setSavedSessions(updated);
    localStorage.setItem('migrator_sessions', JSON.stringify(updated));
  };

  const addLog = (type: LogEntry['type'], message: string) => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      type,
      message: `${message}`
    };
    setLogs(prev => [...prev, entry]);
  };

  const processConfigString = (val: string, skipDetection = false) => {
    setSourceConfig(val);
    if (val.trim()) {
      const parsed = parser.parse(val);
      setSections(parsed.map(s => ({ ...s, status: 'pending' })));
      if (parsed.length > 0) setActiveSectionId(parsed[0].id);
      addLog('INFO', `Parsed ${parsed.length} context domains.`);
      
      if (!skipDetection) {
        handleAutoDetect(val);
      }
    }
  };

  const handleAutoDetect = async (val: string) => {
    setIsDetecting(true);
    try {
      const result = await geminiConverter.identifyHardware(val, settings.activeModel);
      if (result) {
        setTargetSpec(prev => ({
          ...prev,
          sourceModel: prev.sourceModel || result.model || '',
          sourceIOS: prev.sourceIOS || result.ios || ''
        }));
        if (result.model || result.ios) {
          addLog('SUCCESS', `Auto-detected platform: ${result.model || 'Unknown'} / ${result.ios || 'Unknown'}`);
        }
      }
    } catch (e) {
      console.warn("Detection aborted");
    } finally {
      setIsDetecting(false);
    }
  };

  const rebuildTargetConfig = (updatedSections: ConfigSection[]) => {
    const final = updatedSections
      .sort((a, b) => a.priority - b.priority)
      .map(s => s.convertedCommands ? `! --- ${s.name} ---\n${s.convertedCommands.join('\n')}\n!\n` : '')
      .join('');
    setTargetConfig(final);
  };

  const applyAdvisoryFix = (index: number) => {
    const adv = advisories[index];
    if (!adv.suggestedConfig) return;

    setSections(prev => {
      const updated = prev.map(s => {
        if (s.id === adv.sectionId) {
          const currentCommands = s.convertedCommands || [];
          const startIdx = currentCommands.length;
          const fixLines = [`! ADVISORY FIX: ${adv.message}`, adv.suggestedConfig!];
          const newCommands = [...currentCommands, ...fixLines];
          
          const modified = new Set(s.modifiedCommands || []);
          fixLines.forEach((_, i) => modified.add(startIdx + i));

          return { ...s, convertedCommands: newCommands, modifiedCommands: modified };
        }
        return s;
      });
      rebuildTargetConfig(updated);
      return updated;
    });

    addLog('SUCCESS', `Manual patch applied to ${adv.sectionName}.`);
    setAdvisories(prev => prev.filter((_, i) => i !== index));
    setActiveAdvisoryIndex(null);
  };

  const cancelJob = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog('ERROR', 'Migration core sequence terminated.');
      setIsMigrating(false);
    }
  };

  const runMigration = async () => {
    if (sections.length === 0) return;
    setIsMigrating(true);
    setTargetConfig('');
    setAdvisories([]);
    setDeploymentPlan([]);
    setBottomTab('TERMINAL');
    addLog('INFO', `Initializing Synthesis Core [${settings.activeProvider.toUpperCase()} / ${settings.activeModel}]...`);

    abortControllerRef.current = new AbortController();
    const updatedSections = [...sections];
    let allSteps: DeploymentStep[] = [];

    // Initialize the appropriate converter
    let activeConverter: { convertSection: (s: ConfigSection, t: TargetSpec, m: string) => Promise<ConversionResult>, runFinalReview?: any };
    if (settings.activeProvider === 'mistral') {
      activeConverter = new MistralConverter(settings.mistralApiKey);
    } else {
      activeConverter = geminiConverter;
    }

    try {
      for (let i = 0; i < updatedSections.length; i++) {
        if (abortControllerRef.current?.signal.aborted) break;

        const section = updatedSections[i];
        setActiveSectionId(section.id);
        updatedSections[i].status = 'converting';
        setSections([...updatedSections]);

        // Add a safety delay between sections to further mitigate 429 errors
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const result = await activeConverter.convertSection(section, targetSpec, settings.activeModel);
        updatedSections[i].convertedCommands = result.convertedCommands;
        updatedSections[i].modifiedCommands = new Set();
        
        const sectionAdvisories = (result.warnings || []).map(w => ({ 
          ...w, 
          sectionId: section.id, 
          sectionName: section.name 
        }));
        setAdvisories(prev => [...prev, ...sectionAdvisories]);

        if (result.deploymentSteps) {
          allSteps = [...allSteps, ...result.deploymentSteps];
        }

        updatedSections[i].status = sectionAdvisories.length > 0 ? 'warning' : 'success';
        setSections([...updatedSections]);
        rebuildTargetConfig(updatedSections);
      }

      if (!abortControllerRef.current?.signal.aborted) {
        setDeploymentPlan(allSteps.sort((a, b) => a.order - b.order));
        
        if (activeConverter.runFinalReview) {
          addLog('INFO', 'Running Post-Synthesis Syntax Review...');
          const finalLogs = await activeConverter.runFinalReview(targetConfig, targetSpec, settings.activeModel);
          finalLogs.forEach((l: any) => addLog(l.type as any, l.message));
        }
        
        addLog('SUCCESS', 'Core Synthesis finalized.');
        setBottomTab(advisories.length > 0 ? 'ADVISORY' : 'PLAN');
      }
    } catch (err: any) {
      console.error(err);
      const isQuota = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
      const errorMessage = isQuota 
        ? 'Quota exceeded. Engine paused to prevent lockout.' 
        : `Synthesis fault in ${settings.activeProvider} engine.`;
      addLog('ERROR', errorMessage);
    } finally {
      setIsMigrating(false);
      abortControllerRef.current = null;
    }
  };

  const getSectionIcon = (type: SectionType) => {
    switch(type) {
      case SectionType.SYSTEM: return <Monitor className="w-4 h-4" />;
      case SectionType.INTERFACES: return <Activity className="w-4 h-4" />;
      case SectionType.AAA: case SectionType.RADIUS: case SectionType.TACACS: return <ShieldCheck className="w-4 h-4" />;
      case SectionType.VLANS: return <Database className="w-4 h-4" />;
      case SectionType.ROUTING: return <Zap className="w-4 h-4" />;
      default: return <FileCode className="w-4 h-4" />;
    }
  };

  const renderBridgedOutput = () => {
    if (!targetConfig && !isMigrating) return <span className="text-slate-800 italic">No output yet. Run migration to generate CLI syntax.</span>;
    if (isMigrating && !targetConfig) return <div className="animate-pulse space-y-3"><div className="h-4 bg-slate-800 w-3/4 rounded" /><div className="h-4 bg-slate-800 w-1/2 rounded" /></div>;

    return sections.sort((a,b) => a.priority - b.priority).map((s, si) => {
      if (!s.convertedCommands) return null;
      return (
        <div key={si} className="mb-4">
          <div className="text-slate-500 opacity-50 select-none text-[10px] font-bold">! --- {s.name} ---</div>
          {s.convertedCommands.map((cmd, ci) => {
            const isModified = s.modifiedCommands?.has(ci);
            return (
              <div key={ci} className={`${isModified ? 'bg-emerald-500/20 text-emerald-400 border-l-2 border-emerald-500 pl-2 my-0.5' : 'text-slate-200'}`}>
                {cmd}
              </div>
            );
          })}
          <div className="text-slate-500 opacity-50 select-none text-[10px] font-bold">!</div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col overflow-hidden">
      <Header />

      <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex flex-col relative">
            <h2 className="text-[10px] font-black text-amber-500/70 tracking-widest uppercase flex items-center">
              Legacy Platform {isDetecting && <Search className="w-2.5 h-2.5 ml-2 animate-pulse text-blue-400" />}
            </h2>
            <div className="flex items-center space-x-3 mt-1">
              <input 
                value={targetSpec.sourceModel}
                onChange={(e) => setTargetSpec(prev => ({ ...prev, sourceModel: e.target.value }))}
                placeholder="Auto-detecting..."
                className="bg-slate-800 border border-slate-700 text-[11px] font-bold text-amber-200 rounded px-2 py-1 outline-none w-36 focus:border-amber-500/40"
              />
              <input 
                value={targetSpec.sourceIOS}
                onChange={(e) => setTargetSpec(prev => ({ ...prev, sourceIOS: e.target.value }))}
                placeholder="Version..."
                className="bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-400 rounded px-2 py-1 outline-none w-28 focus:border-slate-500"
              />
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-700" />
          <div className="flex flex-col">
            <h2 className="text-[10px] font-black text-blue-500/70 tracking-widest uppercase">Modern Blueprint</h2>
            <div className="flex items-center space-x-3 mt-1">
              <select 
                value={targetSpec.model}
                onChange={(e) => setTargetSpec(prev => ({ ...prev, model: e.target.value }))}
                className="bg-slate-800 border border-slate-700 text-[11px] font-bold text-blue-400 rounded px-2 py-1 outline-none focus:border-blue-500/40"
              >
                <option value="">(Select Model)</option>
                {COMMON_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select 
                value={targetSpec.targetIOS}
                onChange={(e) => setTargetSpec(prev => ({ ...prev, targetIOS: e.target.value }))}
                className="bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 rounded px-2 py-1 outline-none focus:border-slate-500/40"
              >
                <option value="">(Select IOS)</option>
                {IOS_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isMigrating ? (
            <button 
              onClick={cancelJob}
              className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2 rounded-lg text-xs font-bold flex items-center shadow-lg transition-all active:scale-95"
            >
              <XCircle className="w-3.5 h-3.5 mr-2" />
              Cancel Job
            </button>
          ) : (
            <button 
              onClick={runMigration}
              disabled={!sourceConfig}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-xs font-bold flex items-center shadow-lg transition-all active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 mr-2" />
              Start Migration
            </button>
          )}
          <button 
            onClick={saveCurrentSession}
            disabled={!targetConfig}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-bold border border-slate-700 flex items-center space-x-2 transition-all active:scale-90"
            title="Save Project"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => {
              const blob = new Blob([targetConfig], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `bridged_config_${new Date().getTime()}.cfg`; a.click();
            }}
            disabled={!targetConfig}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 px-4 py-2 rounded-lg text-xs font-bold border border-slate-700"
            title="Download CLI Output"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-16 border-r border-slate-800 flex flex-col items-center py-6 space-y-8 bg-slate-950/40">
          <button 
            onClick={() => setRailView('ACTIVITY')}
            className={`p-2 rounded-xl transition-all ${railView === 'ACTIVITY' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Activity className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setRailView('SESSIONS')}
            className={`p-2 rounded-xl transition-all ${railView === 'SESSIONS' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Box className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setRailView('HISTORY')}
            className={`p-2 rounded-xl transition-all ${railView === 'HISTORY' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <History className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-500 hover:text-white transition-colors"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div className="flex overflow-hidden">
          {railView === 'SESSIONS' && (
            <div className="w-64 border-r border-slate-800 bg-slate-900/40 flex flex-col animate-in slide-in-from-left duration-300">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Archived Sessions</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {savedSessions.length === 0 && <p className="text-[10px] text-slate-600 p-4 italic text-center">No projects found.</p>}
                {savedSessions.map(s => (
                  <div key={s.id} className="group bg-slate-800/40 border border-slate-800 p-4 rounded-xl hover:border-slate-600 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[11px] font-bold text-slate-100 truncate flex-1">{s.name}</p>
                      <button onClick={() => deleteSession(s.id)} className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-400 p-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-500 mb-3">{new Date(s.timestamp).toLocaleString()}</p>
                    <button onClick={() => loadSession(s)} className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-black rounded-lg border border-blue-500/20 transition-all">
                      RESTORE PROJECT
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`${isSidebarCollapsed ? 'w-14' : 'w-52'} border-r border-slate-800 bg-slate-900/30 flex flex-col transition-all duration-300`}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center overflow-hidden">
              {!isSidebarCollapsed && <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Logic Blocks</h3>}
              <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-slate-600 hover:text-slate-300 shrink-0">
                {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
              {sections.map(section => (
                <div 
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  title={isSidebarCollapsed ? section.name : undefined}
                  className={`px-4 py-3 flex items-center cursor-pointer transition-colors group ${activeSectionId === section.id ? 'bg-blue-600/10 border-r-2 border-blue-500' : 'hover:bg-slate-800/50'}`}
                >
                  <div className={`shrink-0 ${activeSectionId === section.id ? 'text-blue-400' : 'text-slate-500'}`}>
                    {getSectionIcon(section.type)}
                  </div>
                  {!isSidebarCollapsed && (
                    <>
                      <span className={`text-[11px] font-bold ml-3 truncate flex-1 ${activeSectionId === section.id ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {section.id}
                      </span>
                      {section.status === 'success' && <ShieldCheck className="w-3 h-3 text-emerald-500 ml-2" />}
                      {section.status === 'converting' && <RefreshCw className="w-3 h-3 text-blue-500 animate-spin ml-2" />}
                      {section.status === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-500 ml-2" />}
                      {section.status === 'error' && <Zap className="w-3 h-3 text-rose-500 ml-2" />}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          <div className="flex-1 flex divide-x divide-slate-800 overflow-hidden">
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Legacy Context (Source)</span>
                <button onClick={() => fileInputRef.current?.click()} className="text-[9px] font-bold text-slate-500 hover:text-white flex items-center transition-all">
                  <Upload className="w-3 h-3 mr-1.5" /> LOAD CONFIG
                </button>
                <input type="file" ref={fileInputRef} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => processConfigString(ev.target?.result as string);
                    reader.readAsText(file);
                  }
                }} className="hidden" />
              </div>
              <textarea 
                className="flex-1 bg-transparent p-6 font-mono text-xs leading-relaxed resize-none outline-none text-slate-500 scrollbar-thin placeholder:italic"
                value={sourceConfig}
                onChange={(e) => processConfigString(e.target.value)}
                placeholder="Paste catalyst running-config here..."
              />
            </div>

            <div className="flex-1 flex flex-col bg-[#0f172a]/50">
              <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Bridged Syntax (Target)</span>
                <div className="flex items-center space-x-2">
                   <StatusBadge label="Hierarchy Ready" variant="success" />
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto scrollbar-thin font-mono text-xs leading-relaxed">
                {renderBridgedOutput()}
              </div>
            </div>
          </div>

          <div className="h-64 border-t border-slate-800 bg-[#020617] flex flex-col shadow-2xl">
            <div className="px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/20">
              <div className="flex space-x-8">
                {(['LOG', 'TERMINAL', 'DIFF', 'ADVISORY', 'PLAN'] as BottomTab[]).map((tab) => (
                  <button 
                    key={tab} 
                    onClick={() => setBottomTab(tab)}
                    className={`text-[10px] font-black tracking-widest py-3 transition-all border-b-2 uppercase ${bottomTab === tab ? 'text-blue-400 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                  >
                    {tab === 'ADVISORY' ? `Advisories (${advisories.length})` : tab === 'PLAN' ? 'Deployment workflow' : tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {bottomTab === 'LOG' && (
                <div className="h-full p-4 font-mono text-[10px] overflow-y-auto scrollbar-thin">
                  {logs.length === 0 && <p className="text-slate-700 p-2 italic">Idle. Waiting for configuration upload...</p>}
                  {logs.map((log, i) => (
                    <div key={i} className="flex space-x-3 py-1">
                      <span className="text-slate-600">[{log.timestamp}]</span>
                      <span className={`font-bold ${log.type === 'SUCCESS' ? 'text-emerald-500' : log.type === 'WARNING' ? 'text-amber-500' : log.type === 'ERROR' ? 'text-rose-500' : 'text-blue-400'}`}>
                        {log.type}:
                      </span>
                      <span className="text-slate-400">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {bottomTab === 'ADVISORY' && (
                <div className="h-full flex divide-x divide-slate-800 overflow-hidden">
                  <div className="w-1/3 overflow-y-auto bg-slate-900/40 divide-y divide-slate-800">
                    {advisories.length === 0 ? (
                      <div className="p-12 text-center text-slate-700 opacity-50 uppercase text-[9px] font-bold tracking-widest flex flex-col items-center space-y-3">
                        <ShieldCheck className="w-8 h-8 opacity-20" />
                        <span>Deployment Clear</span>
                      </div>
                    ) : advisories.map((adv, i) => (
                      <div 
                        key={i} 
                        onClick={() => setActiveAdvisoryIndex(i)}
                        className={`p-4 cursor-pointer transition-colors ${activeAdvisoryIndex === i ? 'bg-amber-500/10' : 'hover:bg-white/5'}`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <AlertTriangle className={`w-3.5 h-3.5 ${adv.severity === 'high' ? 'text-rose-500' : 'text-amber-500'}`} />
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">[{adv.sectionName}]</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-300 leading-tight">{adv.message}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto scrollbar-thin">
                    {activeAdvisoryIndex !== null ? (
                      <div className="max-w-3xl animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-6">
                           <div>
                              <h4 className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Platform Vulnerability Flagged</h4>
                              <h2 className="text-xl font-bold text-white">{advisories[activeAdvisoryIndex].message}</h2>
                           </div>
                           <button 
                             onClick={() => applyAdvisoryFix(activeAdvisoryIndex)}
                             className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-xl flex items-center shadow-lg transition-all active:scale-90"
                           >
                             <CheckCircle2 className="w-4 h-4 mr-2" />
                             APPEND MODIFIED CONFIG
                           </button>
                        </div>
                        <div className="space-y-6">
                           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300 text-xs leading-relaxed shadow-inner">
                              <h4 className="text-[10px] font-black text-blue-400 uppercase mb-4 flex items-center">
                                <Info className="w-3.5 h-3.5 mr-2" /> Engineering Directives
                              </h4>
                              {advisories[activeAdvisoryIndex].instructions?.split('\n').map((l, i) => <p key={i} className="mb-3 last:mb-0">{l}</p>)}
                           </div>
                           {advisories[activeAdvisoryIndex].suggestedConfig && (
                             <div>
                                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3">Target Platform Syntax (NX-OS / IOS-XE)</h4>
                                <div className="bg-black/50 border border-slate-800 p-5 font-mono text-emerald-400 text-xs rounded-2xl shadow-xl">
                                   {advisories[activeAdvisoryIndex].suggestedConfig}
                                </div>
                             </div>
                           )}
                        </div>
                      </div>
                    ) : <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-xs uppercase text-slate-500">Select an Advisory to review corrective deployment syntax</div>}
                  </div>
                </div>
              )}

              {bottomTab === 'PLAN' && (
                <div className="h-full p-8 overflow-y-auto scrollbar-thin">
                   <div className="max-w-4xl mx-auto">
                      <div className="flex items-center space-x-4 mb-10">
                         <div className="p-2.5 bg-blue-600/10 rounded-2xl border border-blue-500/20">
                            <ListChecks className="w-6 h-6 text-blue-500" />
                         </div>
                         <div>
                            <h2 className="text-xl font-bold text-white">Recommended Deployment Workflow</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Verification-first configuration strategy</p>
                         </div>
                      </div>
                      
                      {deploymentPlan.length === 0 ? (
                        <div className="text-slate-700 italic opacity-50 py-10 text-center border-2 border-dashed border-slate-900 rounded-3xl">
                          Deployment workflow synthesis will trigger upon successful platform migration.
                        </div>
                      ) : (
                        <div className="space-y-8">
                           {deploymentPlan.map((step, i) => (
                             <div key={i} className="relative pl-12 border-l border-slate-800 pb-10 last:pb-0 group">
                                <div className="absolute -left-4 top-0 w-8 h-8 bg-slate-950 border border-slate-800 rounded-full flex items-center justify-center text-[11px] font-black text-blue-500 group-hover:border-blue-500/50 transition-colors">
                                   {step.order}
                                </div>
                                <div className="flex flex-col lg:flex-row lg:items-start lg:space-x-12">
                                   <div className="flex-1">
                                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{step.phase}</span>
                                      <h3 className="text-lg font-bold text-slate-100 mt-2">{step.task}</h3>
                                   </div>
                                   <div className="w-full lg:w-96 mt-6 lg:mt-0">
                                      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm group-hover:bg-slate-900 transition-all">
                                         <p className="text-[10px] font-black text-emerald-500 uppercase mb-3 flex items-center">
                                           <Activity className="w-3.5 h-3.5 mr-2" /> Verification Logic
                                         </p>
                                         <div className="bg-black/40 px-3 py-2 rounded-lg mb-3">
                                            <code className="text-[11px] font-mono text-slate-200">{step.verificationCmd}</code>
                                         </div>
                                         <p className="text-[10px] text-slate-400 italic">Expected State: <span className="text-emerald-400 font-bold">{step.expectedResult}</span></p>
                                      </div>
                                   </div>
                                </div>
                             </div>
                           ))}
                        </div>
                      )}
                   </div>
                </div>
              )}

              {bottomTab === 'TERMINAL' && (
                <div className="h-full bg-black/60 p-6 font-mono text-[11px] overflow-y-auto text-emerald-500/90 leading-relaxed scrollbar-thin">
                   <div className="opacity-40 mb-3 italic flex items-center space-x-2">
                     <TerminalIcon className="w-3.5 h-3.5" />
                     <span>BRIDGE_TERMINAL_V2_INSTANCE.SH</span>
                   </div>
                   {targetConfig.split('\n').filter(l => l.trim().length > 0).map((l, i) => (
                     <div key={i} className="flex space-x-3 mb-1">
                        <span className="text-slate-800 select-none">switch(config)#</span>
                        <span className="whitespace-pre-wrap">{l}</span>
                     </div>
                   ))}
                   {isMigrating && <div className="w-2 h-4 bg-emerald-500 animate-pulse ml-3 mt-1" />}
                </div>
              )}

              {bottomTab === 'DIFF' && (
                <div className="h-full flex divide-x divide-slate-800 overflow-hidden font-mono text-[10px]">
                   <div className="flex-1 overflow-y-auto p-4 bg-rose-500/5 scrollbar-thin">
                      <div className="text-rose-500/30 text-[9px] font-black uppercase mb-3">[-] DEPRECATED SYNTAX</div>
                      {sourceConfig.split('\n').map((l, i) => <div key={i} className="whitespace-pre px-1 opacity-60 leading-relaxed">{l || ' '}</div>)}
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 bg-emerald-500/5 scrollbar-thin">
                      <div className="text-emerald-500/30 text-[9px] font-black uppercase mb-3">[+] MODERNIZED BLUEPRINT</div>
                      {targetConfig.split('\n').map((l, i) => <div key={i} className="whitespace-pre px-1 leading-relaxed">{l || ' '}</div>)}
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-slate-900 border-t border-slate-800 px-6 py-2 flex items-center justify-between text-[10px] font-bold text-slate-500 tracking-wider">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="uppercase text-slate-400">Synthesis Engine: Synced</span>
          </div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span className="uppercase text-slate-500">Enterprise Verified</span>
          </div>
        </div>
        <div className="flex items-center space-x-6 uppercase">
          <span className="opacity-50">Secure Deployment Portal</span>
          <button className="text-blue-500 hover:text-blue-400 transition-colors">Engineering Documentation</button>
        </div>
      </footer>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        settings={settings} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={handleSettingsSave} 
      />
    </div>
  );
}
