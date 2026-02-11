import { Project, File, User, ExecutionLogEntry } from "../types";

const PROJECTS_KEY = 'thiia_projects';
const FILES_KEY = 'thiia_files';
const EXECUTION_LOGS_KEY = 'thiia_execution_logs';

// Initial Seed Data
const INITIAL_PROJECTS: Project[] = [
  { id: '1', name: 'React Demo', description: 'A simple counter app', language: 'javascript', lastModified: Date.now() },
  { id: '2', name: 'Python Script', description: 'Data processing utility', language: 'python', lastModified: Date.now() - 100000 },
];

const INITIAL_FILES: File[] = [
  { id: 'f1', projectId: '1', name: 'App.js', language: 'javascript', content: "function App() {\n  const [count, setCount] = React.useState(0);\n  return <div>Hello Thiia! Count: {count}</div>;\n}" },
  { id: 'f2', projectId: '1', name: 'utils.js', language: 'javascript', content: "export const add = (a, b) => a + b;" },
  { id: 'f3', projectId: '2', name: 'main.py', language: 'python', content: "def main():\n    print('Hello from Python world!')\n\nif __name__ == '__main__':\n    main()" },
];

export const getProjects = (): Project[] => {
  const stored = localStorage.getItem(PROJECTS_KEY);
  if (!stored) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(INITIAL_PROJECTS));
    localStorage.setItem(FILES_KEY, JSON.stringify(INITIAL_FILES));
    return INITIAL_PROJECTS;
  }
  return JSON.parse(stored);
};

export const createProject = (name: string, description: string, language: Project['language']): Project => {
  const projects = getProjects();
  const newProject: Project = {
    id: crypto.randomUUID(),
    name,
    description,
    language,
    lastModified: Date.now(),
  };
  projects.push(newProject);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  
  // Create default file
  createFile(newProject.id, language === 'python' ? 'main.py' : 'index.js', language, language === 'python' ? 'print("Hello World")' : 'console.log("Hello World");');
  
  return newProject;
};

export const deleteProject = (id: string) => {
  const projects = getProjects().filter(p => p.id !== id);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
};

export const getFiles = (projectId: string): File[] => {
  const stored = localStorage.getItem(FILES_KEY);
  const allFiles: File[] = stored ? JSON.parse(stored) : INITIAL_FILES;
  return allFiles.filter(f => f.projectId === projectId);
};

export const createFile = (projectId: string, name: string, language: string, content: string = '') => {
  const stored = localStorage.getItem(FILES_KEY);
  const allFiles: File[] = stored ? JSON.parse(stored) : INITIAL_FILES;
  const newFile: File = { id: crypto.randomUUID(), projectId, name, language, content };
  allFiles.push(newFile);
  localStorage.setItem(FILES_KEY, JSON.stringify(allFiles));
  return newFile;
};

export const updateFileContent = (fileId: string, content: string) => {
  const stored = localStorage.getItem(FILES_KEY);
  const allFiles: File[] = stored ? JSON.parse(stored) : INITIAL_FILES;
  const index = allFiles.findIndex(f => f.id === fileId);
  if (index !== -1) {
    allFiles[index].content = content;
    localStorage.setItem(FILES_KEY, JSON.stringify(allFiles));
  }
};

export const getExecutionLogs = (projectId: string): ExecutionLogEntry[] => {
  const stored = localStorage.getItem(EXECUTION_LOGS_KEY);
  const allLogs: ExecutionLogEntry[] = stored ? JSON.parse(stored) : [];
  return allLogs.filter(l => l.projectId === projectId).sort((a, b) => b.timestamp - a.timestamp);
};

export const addExecutionLog = (log: ExecutionLogEntry) => {
  const stored = localStorage.getItem(EXECUTION_LOGS_KEY);
  const allLogs: ExecutionLogEntry[] = stored ? JSON.parse(stored) : [];
  allLogs.push(log);
  localStorage.setItem(EXECUTION_LOGS_KEY, JSON.stringify(allLogs));
  return log;
};

export const clearExecutionLogs = (projectId: string) => {
  const stored = localStorage.getItem(EXECUTION_LOGS_KEY);
  let allLogs: ExecutionLogEntry[] = stored ? JSON.parse(stored) : [];
  allLogs = allLogs.filter(l => l.projectId !== projectId);
  localStorage.setItem(EXECUTION_LOGS_KEY, JSON.stringify(allLogs));
};