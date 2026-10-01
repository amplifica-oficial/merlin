import {useChat} from '@ai-sdk/react';
import type {Data} from '@puckeditor/core';
import {useGetPuck} from '@puckeditor/core';
import type {LandingAiConfigResponse, LandingAiPickedElement} from '@merlin/types';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatStatus,
  type UIMessage,
} from 'ai';
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';

import {API_URI} from '../../../lib/constants';
import {network} from '../../../lib/network';
import {serializeCatalog, serializeCatalogSummary} from '../../../lib/puck/ai/catalog';
import {executeLandingAiTool, MUTATING_AI_TOOLS} from '../../../lib/puck/ai/execute-tool';
import {buildOutline} from '../../../lib/puck/ai/outline';
import {applyPick} from '../../../lib/puck/ai/inspector/pick-list';
import {pruneMessages} from '../../../lib/puck/ai/prune-messages';
import {puckConfig} from '../../../lib/puck/config';

export const LANDING_AI_MAX_ROUND_TRIPS = 10;
export const LANDING_AI_MAX_PICKED = 10;

export type LandingAiSidebarTab = 'fields' | 'ai';

export type LandingAiContextValue = {
  enabled: boolean;
  loadingEnabled: boolean;
  messages: UIMessage[];
  status: ChatStatus;
  error: Error | undefined;
  sendText: (text: string) => void;
  stop: () => void;
  appliedCount: number;
  undoLast: () => void;
  sidebarTab: LandingAiSidebarTab;
  setSidebarTab: (tab: LandingAiSidebarTab) => void;
  inspectorActive: boolean;
  toggleInspector: () => void;
  setInspectorActive: (active: boolean) => void;
  pickedElements: LandingAiPickedElement[];
  togglePickedElement: (element: LandingAiPickedElement, options?: {replace?: boolean}) => void;
  removePickedElement: (id: string) => void;
  clearPickedElements: () => void;
  pickNotice: string | null;
  hoveredPickId: string | null;
  setHoveredPickId: (id: string | null) => void;
};

const LandingAiContext = createContext<LandingAiContextValue | null>(null);

export function useLandingAi(): LandingAiContextValue {
  const context = useContext(LandingAiContext);
  if (!context) {
    throw new Error('useLandingAi must be used within LandingAiProvider');
  }
  return context;
}

interface LandingAiProviderProps {
  landingPageId: string;
  children: ReactNode;
}

export function LandingAiProvider({landingPageId, children}: LandingAiProviderProps) {
  const getPuck = useGetPuck();
  const catalog = useMemo(() => serializeCatalog(puckConfig), []);
  const catalogSummary = useMemo(() => serializeCatalogSummary(puckConfig), []);
  const historyIndexBeforeRef = useRef(0);
  const dirtyHistoryRef = useRef(false);
  const autoRoundTripsRef = useRef(0);
  const pendingPickedRef = useRef<LandingAiPickedElement[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loadingEnabled, setLoadingEnabled] = useState(true);
  const [appliedCount, setAppliedCount] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<LandingAiSidebarTab>('fields');
  const [inspectorActive, setInspectorActive] = useState(false);
  const [pickedElements, setPickedElements] = useState<LandingAiPickedElement[]>([]);
  const [hoveredPickId, setHoveredPickId] = useState<string | null>(null);
  const [pickNotice, setPickNotice] = useState<string | null>(null);
  const pickDroppedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await network.fetch<LandingAiConfigResponse>('GET', '/landing-pages/ai/config');
        if (!cancelled) {
          setEnabled(result.enabled);
        }
      } catch {
        if (!cancelled) {
          setEnabled(false);
        }
      } finally {
        if (!cancelled) {
          setLoadingEnabled(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const commitAiHistory = useCallback(() => {
    if (!dirtyHistoryRef.current) {
      return;
    }
    const puck = getPuck();
    puck.dispatch({
      type: 'setData',
      data: puck.appState.data,
      recordHistory: true,
    });
    dirtyHistoryRef.current = false;
  }, [getPuck]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URI}/landing-pages/${landingPageId}/ai/chat`,
        credentials: 'include',
        prepareSendMessagesRequest: ({messages, body}) => {
          const puck = getPuck();
          const projectId = typeof window !== 'undefined' ? localStorage.getItem('activeProjectId') : null;
          return {
            body: {
              ...body,
              messages: pruneMessages(messages),
              catalog: catalogSummary,
              outline: buildOutline(puck.appState.data as Data, catalog),
              selectedId: puck.selectedItem?.props.id ?? null,
              pickedElements: pendingPickedRef.current,
            },
            headers: projectId ? {'X-Project-Id': projectId} : undefined,
          };
        },
      }),
    [catalog, catalogSummary, getPuck, landingPageId],
  );

  const {messages, sendMessage, addToolOutput, status, stop, error} = useChat({
    transport,
    sendAutomaticallyWhen: ({messages: nextMessages}) => {
      if (autoRoundTripsRef.current >= LANDING_AI_MAX_ROUND_TRIPS) {
        return false;
      }
      if (lastAssistantMessageIsCompleteWithToolCalls({messages: nextMessages})) {
        autoRoundTripsRef.current += 1;
        return true;
      }
      return false;
    },
    onFinish: ({messages: nextMessages}) => {
      const shouldContinue =
        autoRoundTripsRef.current < LANDING_AI_MAX_ROUND_TRIPS &&
        lastAssistantMessageIsCompleteWithToolCalls({messages: nextMessages});
      if (!shouldContinue) {
        commitAiHistory();
      }
    },
    onToolCall: ({toolCall}) => {
      if (toolCall.dynamic) {
        return;
      }

      const run = async () => {
        const puck = getPuck();
        const executed = await executeLandingAiTool(
          toolCall.toolName,
          toolCall.input as Record<string, unknown>,
          puck.appState.data as Data,
          catalog,
        );

        if (executed.data) {
          puck.dispatch({type: 'setData', data: executed.data, recordHistory: false});
          dirtyHistoryRef.current = true;
          if (MUTATING_AI_TOOLS.has(toolCall.toolName)) {
            setAppliedCount(count => count + 1);
          }
        }

        addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: executed.result,
        });
      };

      void run();
    },
  });

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !enabled) {
        return;
      }
      historyIndexBeforeRef.current = getPuck().history.index;
      dirtyHistoryRef.current = false;
      autoRoundTripsRef.current = 0;
      pendingPickedRef.current = pickedElements;
      setAppliedCount(0);
      void sendMessage({
        text: trimmed,
        metadata: pickedElements.length > 0 ? {pickedElements} : undefined,
      });
      setPickedElements([]);
      setPickNotice(null);
    },
    [enabled, getPuck, pickedElements, sendMessage],
  );

  const undoLast = useCallback(() => {
    getPuck().history.setHistoryIndex(historyIndexBeforeRef.current);
    dirtyHistoryRef.current = false;
    setAppliedCount(0);
  }, [getPuck]);

  const toggleInspector = useCallback(() => {
    setInspectorActive(current => !current);
  }, []);

  const togglePickedElement = useCallback((element: LandingAiPickedElement, options?: {replace?: boolean}) => {
    setPickedElements(current => {
      const result = applyPick(current, element, {replace: options?.replace, limit: LANDING_AI_MAX_PICKED});
      pickDroppedRef.current = result.dropped;
      return result.items;
    });
    setPickNotice(
      pickDroppedRef.current ? 'Limite de 10 elementos. O mais antigo foi removido.' : null,
    );
    setSidebarTab('ai');
  }, []);

  const removePickedElement = useCallback((id: string) => {
    setPickedElements(current => current.filter(item => item.id !== id));
  }, []);

  const clearPickedElements = useCallback(() => {
    setPickedElements([]);
    setPickNotice(null);
  }, []);

  const value = useMemo<LandingAiContextValue>(
    () => ({
      enabled,
      loadingEnabled,
      messages,
      status,
      error,
      sendText,
      stop,
      appliedCount,
      undoLast,
      sidebarTab,
      setSidebarTab,
      inspectorActive,
      toggleInspector,
      setInspectorActive,
      pickedElements,
      togglePickedElement,
      removePickedElement,
      clearPickedElements,
      pickNotice,
      hoveredPickId,
      setHoveredPickId,
    }),
    [
      appliedCount,
      clearPickedElements,
      enabled,
      error,
      hoveredPickId,
      inspectorActive,
      loadingEnabled,
      messages,
      pickNotice,
      pickedElements,
      removePickedElement,
      togglePickedElement,
      sendText,
      sidebarTab,
      status,
      stop,
      toggleInspector,
      undoLast,
    ],
  );

  return <LandingAiContext.Provider value={value}>{children}</LandingAiContext.Provider>;
}
