import { Agent } from '../core/Agent';
import { PromptOptimizer } from '../core/PromptOptimizer';
import { ArchitectAgent } from './architect/ArchitectAgent';
import { SecurityAgent } from './security/SecurityAgent';
import { FrontendDeveloperAgent } from './development/FrontendDeveloperAgent';
import { BackendDeveloperAgent } from './development/BackendDeveloperAgent';
import { QAAgent } from './qa/QAAgent';

export function getPrebuiltAgents(): Record<string, Agent> {
  return {
    architect: new ArchitectAgent(),
    frontend: new FrontendDeveloperAgent(),
    backend: new BackendDeveloperAgent(),
    qa: new QAAgent(),
    security: new SecurityAgent(),
  };
}

export {
  ArchitectAgent,
  SecurityAgent,
  FrontendDeveloperAgent,
  BackendDeveloperAgent,
  QAAgent,
  PromptOptimizer,
};
