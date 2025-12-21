import { NextRequest, NextResponse } from 'next/server';
import { searchVideos } from '@/lib/searchIndex';

const MEAL_TYPES = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  snack: 'snack',
  dinner: 'dinner',
  dessert: 'dessert'
} as const;

function getMealType(hour: number): keyof typeof MEAL_TYPES {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'dessert'; // Late night
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hourParam = searchParams.get('hour');

  // Use provided hour or default to current server time
  const hour = hourParam ? parseInt(hourParam) : new Date().getHours();
  const mealType = getMealType(hour);

  // Use the search index to find relevant videos for this meal type
  // Only include videos with recipes, fetch more to randomize from
  const allSuggestions = await searchVideos(mealType, 30, true);

  // Shuffle and take 8
  const shuffled = [...allSuggestions].sort(() => Math.random() - 0.5);
  const suggestions = shuffled.slice(0, 8);

  return NextResponse.json({
    mealType,
    suggestions
  });
}
