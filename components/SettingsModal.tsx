
import React, { useState, useEffect } from 'react';
import { X, Cpu, Settings2, Zap, Monitor, Globe, Link, Check, AlertCircle, Loader2, Database, Key } from 'lucide-react';
import { AppSettings, AIProvider } from '../types';
import { GeminiConverter } from '../services/geminiService';
import { MistralConverter } from '../services/mistralService';

interface SettingsModalProps {
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, isOpen, onClose, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'models' | 'behavior'>('models');
  const [isFetchingMistral, setIsFetchingMistral] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const converter = new GeminiConverter();

  const handleFetchMistralModels = async () => {
    if (!localSettings.mistralApiKey) return;
    setIsFetchingMistral(true);
    setTestStatus('testing');
    try {
      const mConverter = new MistralConverter(localSettings.mistralApiKey);
      const models = await mConverter.fetchModels();
      setLocalSettings(prev => ({
        ...prev,
        mistralModels: models,
        activeProvider: 'mistral',
        activeModel: models[0] || prev.activeModel
      }));
      setTestStatus('success');
    } catch (e) {
      setTestStatus('error');
    } finally {
      setIsFetchingMistral(false);
    }
  };

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      if (localSettings.activeProvider === 'google') {
        const success = await converter.testConnection(localSettings.activeModel);
        setTestStatus(success ? 'success' : 'error');
      } else if (localSettings.activeProvider === 'mistral') {
        await handleFetchMistralModels();
      }
    } catch (e) {
      setTestStatus('error');
    }
  };

  const geminiModels = [
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', desc: 'Default (Fastest & Reliable)' },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', desc: 'Enterprise-grade reasoning' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-8 py-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Settings2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Bridge Preferences</h2>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Global Configuration Suite</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-all active:scale-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex px-8 border-b border-slate-800 bg-slate-900/30">
          {(['models', 'behavior'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === tab ? 'text-blue-400 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          {activeTab === 'models' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
              <section className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Google Gemini Engine</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {geminiModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setLocalSettings({ ...localSettings, activeProvider: 'google', activeModel: model.id })}
                      className={`p-4 rounded-2xl border text-left transition-all group ${
                        localSettings.activeModel === model.id && localSettings.activeProvider === 'google'
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-slate-800 hover:border-slate-700 bg-slate-800/20'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <p className={`text-sm font-bold ${localSettings.activeModel === model.id && localSettings.activeProvider === 'google' ? 'text-blue-400' : 'text-slate-300'}`}>
                          {model.label}
                        </p>
                        {localSettings.activeModel === model.id && localSettings.activeProvider === 'google' && <Check className="w-4 h-4 text-blue-500" />}
                      </div>
                      <p className="text-[10px] text-slate-500">{model.desc}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Mistral AI Cloud</h3>
                </div>
                
                <div className="relative mb-4">
                  <Key className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type="password"
                    value={localSettings.mistralApiKey}
                    onChange={(e) => setLocalSettings({...localSettings, mistralApiKey: e.target.value})}
                    placeholder="Enter Mistral API Key"
                    className="w-full bg-slate-800/50 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm font-mono focus:border-blue-500 outline-none transition-colors"
                  />
                </div>

                <button 
                  onClick={handleFetchMistralModels}
                  disabled={!localSettings.mistralApiKey || isFetchingMistral}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-all active:scale-95"
                >
                  {isFetchingMistral ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                  <span>Verify & Fetch Mistral Models</span>
                </button>

                {localSettings.mistralModels.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">Select Mistral Architecture</label>
                    <select
                      value={localSettings.activeProvider === 'mistral' ? localSettings.activeModel : ''}
                      onChange={(e) => setLocalSettings({...localSettings, activeProvider: 'mistral', activeModel: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-slate-200 outline-none focus:border-blue-500"
                    >
                      <option value="" disabled>-- Select Model --</option>
                      {localSettings.mistralModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
              </section>

              <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Monitor className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-300">Target: {localSettings.activeProvider.toUpperCase()} / {localSettings.activeModel}</span>
                </div>
                <button 
                  onClick={testConnection}
                  disabled={testStatus === 'testing'}
                  className={`px-4 py-1.5 rounded-lg border flex items-center space-x-2 transition-all ${
                    testStatus === 'error' ? 'bg-rose-500/10 border-rose-500/50 text-rose-500' : 
                    testStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' :
                    'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {testStatus === 'testing' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : testStatus === 'success' ? (
                    <Check className="w-3 h-3" />
                  ) : testStatus === 'error' ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  <span className="text-[10px] font-black uppercase">{testStatus === 'testing' ? 'Testing...' : 'Test Sync'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'behavior' && (
            <section className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-800/20 rounded-2xl border border-slate-800">
                  <div>
                    <p className="text-sm font-bold text-slate-200">Deep Environment Scan</p>
                    <p className="text-[10px] text-slate-500">Includes system path registry and tool checks</p>
                  </div>
                  <button 
                    onClick={() => setLocalSettings({...localSettings, deepScan: !localSettings.deepScan})}
                    className={`w-12 h-6 rounded-full transition-all relative p-1 ${localSettings.deepScan ? 'bg-blue-600' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-md ${localSettings.deepScan ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-800/20 rounded-2xl border border-slate-800">
                  <div>
                    <p className="text-sm font-bold text-slate-200">Auto-Execute Scripts</p>
                    <p className="text-[10px] text-slate-500">Immediate deployment post-synthesis</p>
                  </div>
                  <button 
                    onClick={() => setLocalSettings({...localSettings, autoExecute: !localSettings.autoExecute})}
                    className={`w-12 h-6 rounded-full transition-all relative p-1 ${localSettings.autoExecute ? 'bg-blue-600' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-md ${localSettings.autoExecute ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="p-8 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 flex justify-end space-x-4">
          <button onClick={onClose} className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all">
            Cancel
          </button>
          <button 
            onClick={() => { onSave(localSettings); onClose(); }}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-blue-900/30 transition-all active:scale-95"
          >
            Deploy Settings
          </button>
        </div>
      </div>
    </div>
  );
};
