import { Badge } from '@/components/ui/badge';
import type { Rank } from '@/lib/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface RankBadgeProps {
  rank: Rank | 'Double President';
  className?: string;
}

// Map the 8 ranks to their image files (exact order from table: 1.Bronze, 2.Silver, 3.Gold, 4.Diamond, 5.Manager, 6.Director, 7.President, 8.Double President)
const rankImages: Partial<Record<Rank | 'Double President', string>> = {
  Bronze: '/images/Bronze.png', // 1. Bronze (60 PV)
  Silver: '/images/Silver.png', // 2. Silver (100 PV)
  Gold: '/images/Gold.png', // 3. Gold (500 PV)
  Diamond: '/images/Daimon.png', // 4. Diamond (1000 PV) - Updated filename to "Daimon.png"
  Manager: '/images/Manager.png', // 5. Manager (1000 PV)
  Director: '/images/Director.png', // 6. Director (1000 PV)
  President: '/images/President.png', // 7. President (1000 PV)
  'Double President': '/images/DoublePresident.png', // 8. Double President
};

// Fallback colors for ranks without images
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
  const imagePath = rankImages[rank];
  
  // If image exists, use image; otherwise use colored badge
  if (imagePath) {
    return (
      <div className={cn('inline-flex items-center justify-center', className)}>
        <Image
          src={imagePath}
          alt={rank}
          width={80}
          height={80}
          className={cn("object-cover", className?.includes('rounded-full') ? 'rounded-full' : '', className?.includes('w-') ? className : 'w-16 h-16')}
          unoptimized
        />
      </div>
    );
  }

  // Handle "Double President" which is not in the Rank type
  const colorClass = rank === 'Double President' 
    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white'
    : rankColors[rank as Rank] || 'bg-gray-500 text-white';

  return (
    <Badge className={cn('text-xs font-bold border-2 border-background', colorClass, className)}>
      {rank}
    </Badge>
  );
}
