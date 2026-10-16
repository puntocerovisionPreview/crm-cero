import { useState, useEffect, useCallback, useRef } from 'react';
import { playTaskDone } from '../utils/sound';
import { hapticFeedback } from '../utils/haptics';

export type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';

export interface SharedTimerState {
  isRunning: boolean;
  timeLeft: number; // in seconds
  mode: PomodoroMode;
  totalDuration: number; // in seconds
  completedSessions: number;
  activeTaskId?: string;
  activeTaskTitle?: string;
  activeProjectId?: string;
}

const DEFAULT_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

let globalTimerListeners: Array<(state: SharedTimerState) => void> = [];

let globalState: SharedTimerState = {
  isRunning: false,
  timeLeft: 25 * 60,
  mode: 'focus',
  totalDuration: 25 * 60,
  completedSessions: 0,
};

let intervalId: any = null;

function broadcastState() {
  globalTimerListeners.forEach(listener => listener({ ...globalState }));
}

function startGlobalTimer() {
  if (intervalId) return;
  globalState.isRunning = true;
  broadcastState();

  intervalId = setInterval(() => {
    if (globalState.timeLeft > 1) {
      globalState.timeLeft -= 1;
      broadcastState();
    } else {
      // Completed session!
      clearInterval(intervalId);
      intervalId = null;
      globalState.isRunning = false;
      globalState.timeLeft = 0;

      if (globalState.mode === 'focus') {
        globalState.completedSessions += 1;
        // Next mode: short or long break
        const nextMode: PomodoroMode = globalState.completedSessions % 4 === 0 ? 'longBreak' : 'shortBreak';
        globalState.mode = nextMode;
        globalState.totalDuration = DEFAULT_DURATIONS[nextMode];
        globalState.timeLeft = DEFAULT_DURATIONS[nextMode];
      } else {
        globalState.mode = 'focus';
        globalState.totalDuration = DEFAULT_DURATIONS.focus;
        globalState.timeLeft = DEFAULT_DURATIONS.focus;
      }

      playTaskDone();
      hapticFeedback.success();
      broadcastState();
    }
  }, 1000);
}

function pauseGlobalTimer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  globalState.isRunning = false;
  broadcastState();
}

function resetGlobalTimer(newMode?: PomodoroMode, customSeconds?: number) {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  const mode = newMode || globalState.mode;
  const duration = customSeconds || DEFAULT_DURATIONS[mode];
  globalState = {
    ...globalState,
    isRunning: false,
    mode,
    totalDuration: duration,
    timeLeft: duration,
  };
  broadcastState();
}

function setActiveTask(taskId?: string, taskTitle?: string, projectId?: string) {
  globalState = {
    ...globalState,
    activeTaskId: taskId,
    activeTaskTitle: taskTitle,
    activeProjectId: projectId,
  };
  broadcastState();
}

export function useTimer() {
  const [timerState, setTimerState] = useState<SharedTimerState>(globalState);

  useEffect(() => {
    const listener = (s: SharedTimerState) => setTimerState(s);
    globalTimerListeners.push(listener);
    return () => {
      globalTimerListeners = globalTimerListeners.filter(l => l !== listener);
    };
  }, []);

  const togglePlay = useCallback(() => {
    hapticFeedback.light();
    if (globalState.isRunning) {
      pauseGlobalTimer();
    } else {
      startGlobalTimer();
    }
  }, []);

  const play = useCallback(() => {
    startGlobalTimer();
  }, []);

  const pause = useCallback(() => {
    pauseGlobalTimer();
  }, []);

  const reset = useCallback((mode?: PomodoroMode, seconds?: number) => {
    resetGlobalTimer(mode, seconds);
  }, []);

  const setMode = useCallback((mode: PomodoroMode) => {
    resetGlobalTimer(mode);
  }, []);

  const setTask = useCallback((taskId?: string, taskTitle?: string, projectId?: string) => {
    setActiveTask(taskId, taskTitle, projectId);
  }, []);

  return {
    ...timerState,
    togglePlay,
    play,
    pause,
    reset,
    setMode,
    setTask,
  };
}
