import React, { useState, useEffect, useRef } from 'react';
import { User, Project, File, ChatMessage, AIComplexity, DebugState, ExecutionLogEntry } from './types';
import * as db from './services/mockDb';
import { generateResponse, generateDebugTrace } from './services/geminiService';

// --- Icons ---
const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <i className={`fa-solid fa-${name} ${className}`}></i>
);

// --- Components ---

const Sidebar = ({ 
  projects, 
  activeProject, 
  onSelectProject, 
  onCreateProject, 
  onLogout 
}: { 
  projects: Project[], 
  activeProject: Project | null, 
  onSelectProject: (p: Project) => void, 
  onCreateProject: () => void,
  onLogout: () => void
}) => (
  <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full flex-shrink-0">
    <div className="p-4 border-b border-zinc-800 flex items-center gap-2 text-indigo-400 font-bold text-xl">
      <Icon name="code-branch" />
      <span>Thiia AI</span>
    </div>
    
    <div className="flex-1 overflow-y-auto p-2">
      <div className="flex justify-between items-center px-2 py-2 mb-2">
        <span className="text-xs font-semibold text-zinc-500 uppercase">Projects</span>
        <button onClick={onCreateProject} className="text-zinc-400 hover:text-white transition">
          <Icon name="plus" />
        </button>
      </div>
      
      <div className="space-y-1">
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => onSelectProject(p)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition flex items-center gap-2 ${
              activeProject?.id === p.id 
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Icon name={p.language === 'python' ? 'python' : 'js'} className="opacity-70" />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </div>
    </div>

    <div className="p-4 border-t border-zinc-800">
      <button 
        onClick={onLogout}
        className="flex items-center gap-2 text-zinc-500 hover:text-red-400 transition text-sm w-full"
      >
        <Icon name="sign-out-alt" />
        <span>Sign Out</span>
      </button>
    </div>
  </div>
);

const FileTree = ({ 
  files, 
  activeFile, 
  onSelectFile,
  onCreateFile
}: { 
  files: File[], 
  activeFile: File | null, 
  onSelectFile: (f: File) => void,
  onCreateFile: () => void
}) => (
  <div className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0">
    <div className="h-9 flex items-center justify-between px-4 border-b border-zinc-800">
      <span className="text-xs font-medium text-zinc-400">EXPLORER</span>
      <button onClick={onCreateFile} className="text-zinc-500 hover:text-zinc-300">
        <Icon name="file-circle-plus" />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto py-2">
      {files.map(f => (
        <button
          key={f.id}
          onClick={() => onSelectFile(f)}
          className={`w-full text-left px-4 py-1.5 text-sm flex items-center gap-2 ${
            activeFile?.id === f.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Icon name="file-code" className="text-xs" />
          <span className="truncate">{f.name}</span>
        </button>
      ))}
    </div>
  </div>
);

const CodeEditor = ({ 
  file, 
  onChange,
  breakpoints,
  onToggleBreakpoint,
  currentLine
}: { 
  file: File | null, 
  onChange: (val: string) => void,
  breakpoints: number[],
  onToggleBreakpoint: (line: number) => void,
  currentLine: number | null
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Sync scrolling
  const handleScroll = () => {
    if (textareaRef.current) {
      const { scrollTop } = textareaRef.current;
      if (gutterRef.current) {
        gutterRef.current.scrollTop = scrollTop;
      }
      if (backdropRef.current) {
        backdropRef.current.scrollTop = scrollTop;
      }
    }
  };

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLine !== null && textareaRef.current) {
      const lineHeight = 24;
      const paddingTop = 16;
      const lineTop = (currentLine - 1) * lineHeight + paddingTop;
      const containerHeight = textareaRef.current.clientHeight;
      const scrollTop = textareaRef.current.scrollTop;
      
      // Scroll if the line is outside of the view or close to edges
      if (lineTop < scrollTop + 24 || lineTop > scrollTop + containerHeight - 48) {
         textareaRef.current.scrollTo({ 
           top: Math.max(0, lineTop - containerHeight / 2), 
           behavior: 'smooth' 
         });
      }
    }
  }, [currentLine]);

  if (!file) {
    return (
      <div className="flex-1 bg-zinc-950 flex flex-col items-center justify-center text-zinc-600">
        <Icon name="code" className="text-6xl mb-4 opacity-20" />
        <p>Select a file to start editing</p>
      </div>
    );
  }

  const lineCount = file.content.split('\n').length;
  const lines = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 relative min-h-0">
      <div className="h-9 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 text-sm text-zinc-400">
        <Icon name="file" className="mr-2 opacity-50" />
        {file.name}
      </div>
      
      <div className="flex-1 relative flex overflow-hidden">
        {/* Gutter (Line numbers & Breakpoints) */}
        <div 
          ref={gutterRef}
          className="w-12 bg-[#1e1e1e] border-r border-zinc-800 text-right select-none text-zinc-600 font-mono text-sm leading-6 pt-4 pb-4 overflow-hidden"
        >
          {lines.map(line => (
             <div 
               key={line} 
               className="px-2 cursor-pointer hover:text-zinc-400 relative group"
               onClick={() => onToggleBreakpoint(line)}
             >
               {breakpoints.includes(line) && (
                 <div className="absolute left-1.5 top-1.5 w-3 h-3 bg-red-500 rounded-full shadow-red-900/50 shadow-lg z-10" />
               )}
               
               {/* Current Execution Line Indicator (Gutter) */}
               {currentLine === line && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-0.5 text-yellow-500 z-10">
                    <Icon name="caret-right" />
                  </div>
               )}

               <span className={breakpoints.includes(line) ? "invisible" : ""}>{line}</span>
             </div>
          ))}
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative">
           
           {/* Backdrop for Synchronized Highlighting */}
           <div 
             ref={backdropRef}
             className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0"
           >
             <div 
               className="w-full relative" 
               style={{ height: `${lines.length * 24 + 32}px` }} // 24px line height, 32px vertical padding (16+16)
             >
               {currentLine !== null && (
                 <div 
                    className="absolute w-full bg-yellow-500/20 border-l-2 border-yellow-500 transition-all duration-150 ease-in-out"
                    style={{ 
                      top: `${(currentLine - 1) * 24 + 16}px`, // 16px top padding
                      height: '24px' 
                    }}
                 />
               )}
             </div>
           </div>

           <textarea
            ref={textareaRef}
            className="absolute inset-0 w-full h-full bg-transparent text-zinc-300 p-4 font-mono text-sm leading-6 resize-none focus:outline-none z-10 whitespace-pre"
            value={file.content}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};

const ConsoleAndDebugger = ({ 
  output, 
  debugState,
  logs,
  onDebugAction,
  onClearLogs
}: { 
  output: string, 
  debugState: DebugState,
  logs: ExecutionLogEntry[],
  onDebugAction: (action: 'step' | 'continue' | 'stop') => void,
  onClearLogs: () => void
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'variables' | 'history'>('console');

  useEffect(() => {
    if (debugState.isActive) {
      setActiveTab('variables');
    }
  }, [debugState.isActive]);

  return (
    <div className="h-64 bg-zinc-900 border-t border-zinc-800 flex flex-col flex-shrink-0">
      <div className="h-9 flex items-center justify-between px-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex gap-1">
          <button 
            onClick={() => setActiveTab('console')}
            className={`px-3 py-1 text-xs font-medium rounded-t-md transition ${activeTab === 'console' ? 'text-white bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            TERMINAL
          </button>
          <button 
            onClick={() => setActiveTab('variables')}
            className={`px-3 py-1 text-xs font-medium rounded-t-md transition ${activeTab === 'variables' ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            VARIABLES
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 text-xs font-medium rounded-t-md transition ${activeTab === 'history' ? 'text-emerald-400 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            HISTORY
          </button>
        </div>

        {debugState.isActive ? (
          <div className="flex items-center gap-1 pr-2">
             <button 
               onClick={() => onDebugAction('continue')}
               title="Continue"
               className="p-1.5 text-green-400 hover:bg-zinc-800 rounded"
             >
               <Icon name="play" />
             </button>
             <button 
               onClick={() => onDebugAction('step')}
               title="Step Over"
               className="p-1.5 text-blue-400 hover:bg-zinc-800 rounded"
             >
               <Icon name="arrow-right-to-bracket" className="rotate-90" />
             </button>
             <button 
               onClick={() => onDebugAction('stop')}
               title="Stop Debugging"
               className="p-1.5 text-red-400 hover:bg-zinc-800 rounded"
             >
               <Icon name="stop" />
             </button>
          </div>
        ) : (
          activeTab === 'history' && (
            <button 
              onClick={onClearLogs} 
              className="text-xs text-zinc-500 hover:text-red-400 px-2"
              title="Clear Logs"
            >
              <Icon name="trash" /> Clear
            </button>
          )
        )}
      </div>

      <div className="flex-1 overflow-auto bg-zinc-900 relative">
        {activeTab === 'console' && (
          <div className="p-3 font-mono text-xs text-zinc-300 whitespace-pre-wrap">
            {output || <span className="text-zinc-600 italic">Ready to execute...</span>}
          </div>
        )}
        
        {activeTab === 'variables' && (
          <div className="p-0">
            {debugState.isActive ? (
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-800 text-zinc-400 font-medium">
                  <tr>
                    <th className="px-4 py-2 w-1/3">Variable</th>
                    <th className="px-4 py-2">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {Object.entries(debugState.variables).length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-zinc-500 italic text-center">No local variables</td>
                    </tr>
                  ) : (
                    Object.entries(debugState.variables).map(([key, val]) => (
                      <tr key={key} className="hover:bg-zinc-800/30">
                        <td className="px-4 py-2 font-mono text-indigo-300">{key}</td>
                        <td className="px-4 py-2 font-mono text-zinc-300">{val}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <div className="p-4 text-zinc-500 text-xs italic text-center">
                Start debugging to inspect variables.
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-0">
            {logs.length === 0 ? (
              <div className="p-4 text-zinc-500 text-xs italic text-center">
                No execution history yet.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-800 text-zinc-400 font-medium sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-24">Time</th>
                    <th className="px-3 py-2 w-20">Lang</th>
                    <th className="px-3 py-2">Preview</th>
                    <th className="px-3 py-2 w-20 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30 group">
                      <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 text-zinc-400 font-mono">{log.language}</td>
                      <td className="px-3 py-2 text-zinc-300 font-mono truncate max-w-xs" title={log.output}>
                         {log.output.slice(0, 50).replace(/\n/g, ' ')}{log.output.length > 50 && '...'}
                      </td>
                      <td className="px-3 py-2 text-zinc-500 text-right font-mono">{log.executionTimeStr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatInterface = ({ 
  messages, 
  onSendMessage, 
  isTyping 
}: { 
  messages: ChatMessage[], 
  onSendMessage: (msg: string, complexity: AIComplexity) => void,
  isTyping: boolean
}) => {
  const [input, setInput] = useState("");
  const [complexity, setComplexity] = useState<AIComplexity>('low');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input, complexity);
    setInput("");
  };

  return (
    <div className="w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full flex-shrink-0">
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
        <span className="font-semibold text-zinc-300 flex items-center gap-2">
          <Icon name="robot" className="text-indigo-500" />
          AI Assistant
        </span>
        <div className="flex gap-1 bg-zinc-800 p-0.5 rounded-lg">
          <button 
            onClick={() => setComplexity('low')}
            title="Flash Lite (Fast)"
            className={`p-1.5 rounded text-xs transition ${complexity === 'low' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Icon name="bolt" />
          </button>
          <button 
            onClick={() => setComplexity('high')}
            title="Gemini Pro (Deep Thinking)"
            className={`p-1.5 rounded text-xs transition ${complexity === 'high' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Icon name="brain" />
          </button>
          <button 
            onClick={() => setComplexity('research')}
            title="Research Mode"
            className={`p-1.5 rounded text-xs transition ${complexity === 'research' ? 'bg-teal-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Icon name="book-open" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
            }`}>
              {msg.role === 'assistant' && (
                <div className="text-[10px] text-zinc-500 mb-1 font-mono uppercase tracking-wider flex items-center gap-1">
                   <Icon name={msg.model.includes('pro') ? 'brain' : 'bolt'} />
                   {msg.model.replace('gemini-', '').replace('-preview', '').replace('-latest', '')}
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-zinc-500 text-xs pl-2">
            <Icon name="circle-notch" className="fa-spin" />
            <span>AI is thinking...</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${complexity === 'low' ? 'Flash' : complexity === 'high' ? 'Deep Thinker' : 'Researcher'}...`}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg pl-4 pr-10 py-3 focus:outline-none focus:border-indigo-500 transition shadow-sm"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-indigo-400 disabled:opacity-50 p-2"
          >
            <Icon name="paper-plane" />
          </button>
        </div>
        <div className="text-[10px] text-zinc-600 mt-2 text-center">
          {complexity === 'low' && "⚡ Using gemini-2.5-flash-lite for instant answers"}
          {complexity === 'high' && "🧠 Using gemini-3-pro with thinking capability"}
          {complexity === 'research' && "📚 Using gemini-3-flash for detailed research"}
        </div>
      </form>
    </div>
  );
};

// --- Main App Logic ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [consoleOutput, setConsoleOutput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  
  // Debug State
  const [debugState, setDebugState] = useState<DebugState>({
    isActive: false,
    isPaused: false,
    currentStepIndex: -1,
    trace: [],
    breakpoints: [],
    variables: {}
  });

  // Load User / Session
  useEffect(() => {
    const savedUser = localStorage.getItem('thiia_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Load Projects on Auth
  useEffect(() => {
    if (user) {
      setProjects(db.getProjects());
    }
  }, [user]);

  // Load Files and Logs when Project Changes
  useEffect(() => {
    if (activeProject) {
      const pFiles = db.getFiles(activeProject.id);
      setFiles(pFiles);
      if (pFiles.length > 0) setActiveFile(pFiles[0]);
      
      // Load logs
      setExecutionLogs(db.getExecutionLogs(activeProject.id));
      
      setConsoleOutput("");
      setChatMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Welcome to project ${activeProject.name}! I'm ready to help you code.`,
        model: 'system',
        timestamp: Date.now()
      }]);
      // Reset Debug state on project switch
      setDebugState({
        isActive: false,
        isPaused: false,
        currentStepIndex: -1,
        trace: [],
        breakpoints: [],
        variables: {}
      });
    } else {
      setFiles([]);
      setActiveFile(null);
      setExecutionLogs([]);
    }
  }, [activeProject]);

  const handleLogin = () => {
    const mockUser: User = { id: 'u1', name: 'Developer', email: 'dev@thiia.ai' };
    localStorage.setItem('thiia_user', JSON.stringify(mockUser));
    setUser(mockUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('thiia_user');
    setUser(null);
    setActiveProject(null);
  };

  const handleCreateProject = () => {
    const name = prompt("Project Name:");
    if (!name) return;
    const newProj = db.createProject(name, "New Project", "javascript");
    setProjects(db.getProjects());
    setActiveProject(newProj);
  };

  const handleCreateFile = () => {
    if (!activeProject) return;
    const name = prompt("File Name (e.g. script.js):");
    if (!name) return;
    const newFile = db.createFile(activeProject.id, name, "javascript");
    setFiles(db.getFiles(activeProject.id));
    setActiveFile(newFile);
  };

  const handleFileChange = (newContent: string) => {
    if (!activeFile) return;
    const updated = { ...activeFile, content: newContent };
    setActiveFile(updated);
    setFiles(files.map(f => f.id === activeFile.id ? updated : f));
    db.updateFileContent(activeFile.id, newContent);
    
    // If editing, stop debug
    if (debugState.isActive) {
      setDebugState(prev => ({ ...prev, isActive: false, trace: [], currentStepIndex: -1 }));
    }
  };

  const handleToggleBreakpoint = (line: number) => {
    setDebugState(prev => {
      const exists = prev.breakpoints.includes(line);
      return {
        ...prev,
        breakpoints: exists 
          ? prev.breakpoints.filter(b => b !== line) 
          : [...prev.breakpoints, line]
      };
    });
  };

  const startDebugging = async () => {
    if (!activeFile) return;
    setConsoleOutput("Initializing debugger (AI Simulation)...\nGenerating execution trace...");
    
    // Reset state but keep breakpoints
    setDebugState(prev => ({ 
      ...prev, 
      isActive: true, 
      isPaused: true, 
      currentStepIndex: -1, 
      trace: [],
      variables: {} 
    }));

    const trace = await generateDebugTrace(activeFile.content, activeFile.language);
    
    if (trace.length === 0) {
      setConsoleOutput("Debugger failed to initialize or code produced no trace.");
      setDebugState(prev => ({ ...prev, isActive: false }));
      return;
    }

    setDebugState(prev => ({
      ...prev,
      trace,
      currentStepIndex: 0,
      isPaused: true, // Start paused at first line
      variables: trace[0].variables,
    }));
    setConsoleOutput(`Debugger started.\nPaused at line ${trace[0].line}.`);
  };

  const handleDebugAction = (action: 'step' | 'continue' | 'stop') => {
    if (!debugState.isActive || !debugState.trace.length) return;

    if (action === 'stop') {
      setDebugState(prev => ({ 
        ...prev, 
        isActive: false, 
        currentStepIndex: -1,
        trace: [],
        variables: {}
      }));
      setConsoleOutput(prev => prev + "\nDebugger stopped.");
      return;
    }

    // Logic for stepping/continuing
    let cursor = debugState.currentStepIndex;
    let hitBreakpoint = false;
    let outputAccumulator = "";
    
    // Determine the steps to run
    if (action === 'step') {
      // Execute the *current* step output (if any), then move cursor one forward
      if (debugState.trace[cursor] && debugState.trace[cursor].output) {
        outputAccumulator += debugState.trace[cursor].output + "\n";
      }
      cursor++;
      
      // If we stepped past the end
      if (cursor >= debugState.trace.length) {
         setConsoleOutput(prev => prev + outputAccumulator + "\nExecution finished.");
         setDebugState(prev => ({ ...prev, isActive: false, currentStepIndex: -1 }));
         return;
      }
      
    } else if (action === 'continue') {
      // Loop: execute current step's output, advance, check if new step is breakpoint
      while (cursor < debugState.trace.length - 1) {
        // Execute output of the step we are leaving
        if (debugState.trace[cursor].output) {
           outputAccumulator += debugState.trace[cursor].output + "\n";
        }
        
        cursor++; // Move to next step
        
        // Check if the NEW step is on a breakpoint line
        if (debugState.breakpoints.includes(debugState.trace[cursor].line)) {
            hitBreakpoint = true;
            break;
        }
      }
      
      // If we exited loop because we reached the very last step and it wasn't a BP
      if (cursor === debugState.trace.length - 1 && !hitBreakpoint) {
         if (cursor >= debugState.trace.length - 1 && !hitBreakpoint) {
             // Execute output of the final step
             if (debugState.trace[cursor] && debugState.trace[cursor].output) {
                 outputAccumulator += debugState.trace[cursor].output + "\n";
             }
             setConsoleOutput(prev => prev + outputAccumulator + "\nExecution finished.");
             setDebugState(prev => ({ ...prev, isActive: false, currentStepIndex: -1 }));
             return;
         }
      }
    }

    setConsoleOutput(prev => prev + outputAccumulator);
    setDebugState(prev => ({
      ...prev,
      currentStepIndex: cursor,
      variables: debugState.trace[cursor].variables,
      isPaused: true
    }));
  };
  
  const handleClearLogs = () => {
    if (activeProject) {
      db.clearExecutionLogs(activeProject.id);
      setExecutionLogs([]);
    }
  };

  const executeCode = async () => {
    if (!activeFile) return;
    setConsoleOutput("Running...");
    const startTime = Date.now();
    let finalOutput = "";
    
    // Simulate execution delay
    await new Promise(r => setTimeout(r, 600));

    try {
      if (activeFile.language === 'javascript') {
        let logs: string[] = [];
        const mockConsole = {
          log: (...args: any[]) => logs.push(args.map(a => String(a)).join(' '))
        };
        // eslint-disable-next-line no-new-func
        const run = new Function('console', activeFile.content);
        run(mockConsole);
        finalOutput = logs.join('\n') || "No output.";
      } else {
        finalOutput = `[Mock Interpreter]\nExecuting ${activeFile.language}...\n\nOutput:\n> Hello from the simulated backend!`;
      }
    } catch (e: any) {
      finalOutput = `Error: ${e.message}`;
    }
    
    const endTime = Date.now();
    const duration = `${endTime - startTime}ms`;
    
    setConsoleOutput(finalOutput);
    
    // Log execution
    if (activeProject) {
       const log: ExecutionLogEntry = {
          id: crypto.randomUUID(),
          projectId: activeProject.id,
          timestamp: startTime,
          codeSnippet: activeFile.content,
          language: activeFile.language,
          output: finalOutput,
          executionTimeStr: duration
       };
       db.addExecutionLog(log);
       setExecutionLogs(prev => [log, ...prev]);
    }
  };

  const handleSendMessage = async (text: string, complexity: AIComplexity) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      model: 'user',
      timestamp: Date.now()
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setIsAiTyping(true);

    const context = activeFile ? `Current File: ${activeFile.name}\nLanguage: ${activeFile.language}\nContent:\n${activeFile.content}` : "No file selected.";
    const aiText = await generateResponse(text, context, complexity);
    
    setIsAiTyping(false);
    
    const aiMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: aiText,
      model: complexity === 'high' ? 'gemini-3-pro' : complexity === 'research' ? 'gemini-3-flash' : 'gemini-2.5-flash-lite',
      timestamp: Date.now()
    };
    
    setChatMessages(prev => [...prev, aiMsg]);
  };

  if (!user) {
    return (
      <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(79,70,229,0.2),rgba(0,0,0,0))]" />
        
        <div className="z-10 text-center space-y-8 p-8 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-xl shadow-indigo-500/10">
               <Icon name="code-branch" className="text-4xl text-indigo-400" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">Thiia AI</h1>
            <p className="text-zinc-400">Next-gen AI Development Environment</p>
          </div>

          <div className="space-y-4 pt-4">
            <button 
              onClick={handleLogin}
              className="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-gray-100 transition flex items-center justify-center gap-3"
            >
              <Icon name="github" className="text-xl" />
              Continue with GitHub
            </button>
            <button 
              onClick={handleLogin}
              className="w-full bg-[#1a1a1a] border border-zinc-800 text-white py-3 rounded-lg font-medium hover:bg-zinc-800 transition flex items-center justify-center gap-3"
            >
              <Icon name="google" className="text-xl" />
              Continue with Google
            </button>
          </div>
          
          <p className="text-xs text-zinc-600 pt-8">
            Powered by Gemini 2.5 Flash Lite & 3 Pro
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-gray-200 font-sans overflow-hidden">
      <Sidebar 
        projects={projects}
        activeProject={activeProject}
        onSelectProject={setActiveProject}
        onCreateProject={handleCreateProject}
        onLogout={handleLogout}
      />
      
      {activeProject ? (
        <>
          <FileTree 
            files={files}
            activeFile={activeFile}
            onSelectFile={setActiveFile}
            onCreateFile={handleCreateFile}
          />
          
          <div className="flex-1 flex flex-col min-w-0">
            {/* Editor Toolbar */}
            <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0">
               <div className="flex items-center gap-2 text-sm">
                 <span className="text-zinc-500">{activeProject.name}</span>
                 <span className="text-zinc-700">/</span>
                 <span className="text-zinc-200 font-medium">{activeFile?.name}</span>
               </div>
               <div className="flex items-center gap-2">
                 {/* Regular Run */}
                 {!debugState.isActive && (
                    <button 
                      onClick={executeCode}
                      className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded text-sm transition font-medium border border-zinc-700"
                    >
                      <Icon name="play" className="text-xs" />
                      Run
                    </button>
                 )}

                 {/* Debug Button (Toggle) */}
                 {!debugState.isActive ? (
                   <button 
                     onClick={startDebugging}
                     className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded text-sm transition font-medium"
                   >
                     <Icon name="bug" className="text-xs" />
                     Debug
                   </button>
                 ) : (
                    <div className="flex items-center gap-2 bg-indigo-900/50 text-indigo-300 px-3 py-1.5 rounded text-sm border border-indigo-500/30">
                      <Icon name="circle-notch" className="fa-spin text-xs" />
                      Debugging Session Active
                    </div>
                 )}
               </div>
            </div>
            
            <div className="flex-1 flex flex-col min-h-0">
               <CodeEditor 
                 file={activeFile} 
                 onChange={handleFileChange}
                 breakpoints={debugState.breakpoints}
                 onToggleBreakpoint={handleToggleBreakpoint}
                 currentLine={debugState.isActive && debugState.currentStepIndex >= 0 && debugState.trace[debugState.currentStepIndex] ? debugState.trace[debugState.currentStepIndex].line : null}
               />
               <ConsoleAndDebugger 
                 output={consoleOutput} 
                 debugState={debugState}
                 logs={executionLogs}
                 onDebugAction={handleDebugAction}
                 onClearLogs={handleClearLogs}
               />
            </div>
          </div>
          
          <ChatInterface 
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            isTyping={isAiTyping}
          />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
             <Icon name="layer-group" className="text-2xl opacity-50" />
          </div>
          <p className="text-lg font-medium text-zinc-400">Select or create a project to begin</p>
          <p className="text-sm mt-2 max-w-md text-center">
            Thiia AI combines local execution with intelligent cloud assistance.
          </p>
        </div>
      )}
    </div>
  );
}