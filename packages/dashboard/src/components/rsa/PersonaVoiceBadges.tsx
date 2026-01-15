'use client';

import { Badge } from '@/components/ui/badge';
import { getPersonaName, getVoiceName } from '@/lib/rsa/types';

interface PersonaVoiceBadgesProps {
  personaId: string | null;
  voiceId: string | null;
  showLabels?: boolean;
}

export function PersonaVoiceBadges({
  personaId,
  voiceId,
  showLabels = false,
}: PersonaVoiceBadgesProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {personaId && (
        <div className="flex items-center gap-1">
          {showLabels && (
            <span className="text-xs text-muted-foreground">Persona:</span>
          )}
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
            {getPersonaName(personaId)}
          </Badge>
        </div>
      )}
      {voiceId && (
        <div className="flex items-center gap-1">
          {showLabels && (
            <span className="text-xs text-muted-foreground">Voice:</span>
          )}
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
            {getVoiceName(voiceId)}
          </Badge>
        </div>
      )}
    </div>
  );
}
