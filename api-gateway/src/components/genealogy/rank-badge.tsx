import { Badge } from '@/components/ui/badge';
import type { Rank } from '@/lib/types';
import { cn } from '@/lib/utils';

interface RankBadgeProps {
  rank: Rank;
  className?: string;
}

const rankColors: Record<Rank, string> = {
  Member: 'bg-gray-500 text-white',
  Bronze: 'bg-yellow-700 text-white',
  Silver: 'bg-slate-400 text-black',
  Gold: 'bg-yellow-500 text-black',
  Diamond: 'bg-cyan-200 text-black',
  'Blue Diamond': 'bg-blue-400 text-white',
  'Super Diamond': 'bg-pink-400 text-white',
  'Half STAR': 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white',
  STAR: 'bg-purple-500 text-white',
  Elite: 'bg-red-500 text-white',
  Supervisor: 'bg-indigo-500 text-white',
  Manager: 'bg-green-600 text-white',
  Director: 'bg-pink-600 text-white',
  President: 'bg-orange-600 text-white',
  Chairman: 'bg-black text-white',
  'Black Diamond': 'bg-gray-900 text-cyan-300 border border-cyan-300',
  Emerald: 'bg-emerald-500 text-white',
  'Blue Emerald': 'bg-teal-500 text-white',
  Crown: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
  'Double Diamond': 'bg-gradient-to-r from-cyan-200 to-blue-400 text-white',
  Expired: 'bg-red-800 text-white',
};

export default function RankBadge({ rank, className }: RankBadgeProps) {
  return (
    <Badge className={cn('text-xs font-bold border-2 border-background', rankColors[rank], className)}>
      {rank}
    </Badge>
  );
}
