import { UserProfile } from "../types";

export async function getSmartGroupSuggestions(_profile: UserProfile) {
  // Static suggestions for deterministic launch
  return [
    { name: 'Quit Vaping Together', members: 1240, type: 'support', icon: '🚭', reason: 'Common ground group for general cessation support.' },
    { name: 'Morning Runners', members: 850, type: 'fitness', icon: '🏃', reason: 'Focus on physical repair and fresh air.' },
    { name: 'Deep Work Club', members: 420, type: 'productivity', icon: '🧠', reason: 'Stay productive during peak trigger periods.' },
  ];
}
