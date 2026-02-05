export interface RecipeSearchResult {
  id: string;
  title: string;
  channelName: string;
  thumbnail?: string;
  description?: string;
  duration?: number;
  viewCount?: number;
}

export interface GenerateOffer {
  type: 'generate-offer';
  title: string;
  reason: string;
  inspirationId?: string;
  inspirationTitle?: string;
}

export type ChatToolResult = RecipeSearchResult | GenerateOffer;

export function isGenerateOffer(result: ChatToolResult): result is GenerateOffer {
  return 'type' in result && result.type === 'generate-offer';
}

export type ChatVariant = 'conversational' | 'focused' | 'guided';

export interface QuickAction {
  label: string;
  prompt: string;
  icon?: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Quick weeknight dinner', prompt: 'Find me a quick and easy weeknight dinner recipe' },
  { label: 'Something with chicken', prompt: 'What can I make with chicken?' },
  { label: 'Healthy options', prompt: 'Show me some healthy recipe options' },
  { label: 'Comfort food', prompt: 'I want some comfort food classics' },
  { label: 'Vegetarian', prompt: 'Find vegetarian recipes' },
  { label: 'Under 30 minutes', prompt: 'Recipes that take under 30 minutes' },
];
