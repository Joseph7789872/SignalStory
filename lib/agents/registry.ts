// Central list of agents and their in-code default instruction + version.
// Used by the prompt-versioning seed and the Prompts API so the UI can show
// (and fork) the current defaults even before anything is stored in the DB.
import * as eventListener from "./eventListener";
import * as significanceScorer from "./significanceScorer";
import * as storyFinder from "./storyFinder";
import * as narrativeStrategist from "./narrativeStrategist";
import * as channelTransformer from "./channelTransformer";
import * as antiSlopEditor from "./antiSlopEditor";

export type AgentDefault = {
  agent: string;
  label: string;
  version: string;
  instruction: string;
};

export const AGENT_DEFAULTS: AgentDefault[] = [
  {
    agent: "event_listener",
    label: "Event Listener",
    version: eventListener.PROMPT_VERSION,
    instruction: eventListener.INSTRUCTION,
  },
  {
    agent: "significance_scorer",
    label: "Significance Scorer",
    version: significanceScorer.PROMPT_VERSION,
    instruction: significanceScorer.INSTRUCTION,
  },
  {
    agent: "story_finder",
    label: "Story Finder",
    version: storyFinder.PROMPT_VERSION,
    instruction: storyFinder.INSTRUCTION,
  },
  {
    agent: "narrative_strategist",
    label: "Narrative Strategist",
    version: narrativeStrategist.PROMPT_VERSION,
    instruction: narrativeStrategist.INSTRUCTION,
  },
  {
    agent: "channel_transformer",
    label: "Channel Transformer",
    version: channelTransformer.PROMPT_VERSION,
    instruction: channelTransformer.BUNDLE_INSTRUCTION,
  },
  {
    agent: "anti_slop_editor",
    label: "Anti-Slop Editor",
    version: antiSlopEditor.PROMPT_VERSION,
    instruction: antiSlopEditor.INSTRUCTION,
  },
];
