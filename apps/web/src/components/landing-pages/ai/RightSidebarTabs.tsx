import {Tabs, TabsList, TabsTrigger} from '@merlin/ui';
import {type ReactNode} from 'react';

import {AiChatPanel} from './AiChatPanel';
import {useLandingAi} from './LandingAiProvider';

interface RightSidebarTabsProps {
  children: ReactNode;
}

export function RightSidebarTabs({children}: RightSidebarTabsProps) {
  const {sidebarTab, setSidebarTab} = useLandingAi();

  return (
    <Tabs value={sidebarTab} onValueChange={value => setSidebarTab(value as 'fields' | 'ai')} className="flex h-full min-h-0 flex-col">
      <TabsList className="mx-2 mt-2 grid h-9 w-auto grid-cols-2">
        <TabsTrigger value="fields">Campos</TabsTrigger>
        <TabsTrigger value="ai">IA</TabsTrigger>
      </TabsList>
      <div className={sidebarTab === 'fields' ? 'min-h-0 flex-1 overflow-auto' : 'hidden'}>{children}</div>
      <div className={sidebarTab === 'ai' ? 'min-h-0 flex-1 overflow-hidden' : 'hidden'}>
        <AiChatPanel />
      </div>
    </Tabs>
  );
}
