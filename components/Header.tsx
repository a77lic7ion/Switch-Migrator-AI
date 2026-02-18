
import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 py-4 sticky top-0 z-[60]">
      <div className="container mx-auto px-6 flex justify-between items-center">
        <div className="flex items-center space-x-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl shadow-lg shadow-blue-900/20">
              <Zap className="text-white w-5 h-5" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center">
              SWITCH MIGRATOR <span className="text-blue-500 ml-1.5 font-light">AI</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Enterprise Edition v2.4.0</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="hidden md:flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Verified Syntax Engine</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
