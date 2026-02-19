import { useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';

interface ProjectSelectorProps {
  onSelect: (dir: string) => void;
  selectedDir: string | null;
  listProjects: () => void;
}

export default function ProjectSelector({
  onSelect,
  selectedDir,
  listProjects,
}: ProjectSelectorProps) {
  const projects = useChatStore((s) => s.projects);
  const isConnected = useChatStore((s) => s.isConnected);

  useEffect(() => {
    if (isConnected) {
      listProjects();
    }
  }, [isConnected, listProjects]);

  return (
    <div className="relative">
      <select
        value={selectedDir ?? ''}
        onChange={(e) => {
          if (e.target.value) {
            onSelect(e.target.value);
          }
        }}
        className="appearance-none rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 pr-8 text-sm text-surface-200 outline-none transition-colors focus:border-primary-500 hover:border-surface-500"
      >
        <option value="">Select project...</option>
        {projects.map((project) => (
          <option key={project.path} value={project.path}>
            {project.name}
          </option>
        ))}
      </select>
      {/* Dropdown arrow */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg
          className="h-4 w-4 text-surface-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
